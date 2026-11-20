import logging
import os
import re
from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

logging.basicConfig(
    level=logging.INFO,
    filename='/home/devuser/scanner/app.log',
    filemode='a',
    format='%(asctime)s %(levelname)s %(message)s',
)
logger = logging.getLogger(__name__)

API_KEY = os.environ.get('SCANNER_API_KEY', '')

# ── Optional ML libraries — degrade gracefully ────────────────────────────────

profanity_checker = None
toxicity_model = None

try:
    from better_profanity import profanity as _prof
    _prof.load_censor_words()
    # Extend with terms the default list misses (British English, mild profanity, slurs)
    _prof.add_censor_words([
        'bloody', 'bollocks', 'bugger', 'sod off', 'sodding', 'git', 'pillock',
        'wanker', 'tosser', 'twat', 'prat', 'muppet', 'numpty',
        'bastard', 'crap', 'damn', 'dammit', 'freaking', 'frigging',
        'screw you', 'shut up', 'piss off', 'pissed',
        'arse', 'arsehole', 'bloke',
    ])
    profanity_checker = _prof
    logger.info('better_profanity loaded with extended word list')
except Exception as e:
    logger.warning(f'better_profanity unavailable: {e}')

try:
    from detoxify import Detoxify
    toxicity_model = Detoxify('original')
    logger.info('Detoxify loaded')
except Exception as e:
    logger.warning(f'Detoxify unavailable: {e}')

# ── Personal data ─────────────────────────────────────────────────────────────
# Only concrete, structured personal data: contact details and ID / financial
# numbers. Names are not flagged: naming people (MPs, authors, other members)
# is normal in debate, and name-spotting models mistake Capitalised Phrases
# ("Extreme Weather and Climate") for people.

def _digits(s: str) -> str:
    return re.sub(r'\D', '', s)

def _luhn(num: str) -> bool:
    total, alt = 0, False
    for d in reversed(num):
        n = int(d)
        if alt:
            n *= 2
            if n > 9:
                n -= 9
        total += n
        alt = not alt
    return total % 10 == 0

EMAIL = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b')
# Phone numbers: international (+44 …), UK (07…, 01…, 02…, 03…), or North American (555) 123-4567
PHONE = re.compile(
    r'(?<![\w+])(?:'
    r'\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}'          # +44 7700 900123, +1 415 555 0100
    r'|\(?0\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}'                    # 07700 900123, (0131) 496 0000, 020 7946 0000
    r'|\(\d{3}\)\s?\d{3}[\s.-]\d{4}'                                  # (415) 555-0100
    r')(?![\w])')
CARD = re.compile(r'(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)')
NI_NUMBER = re.compile(r'\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b', re.I)
US_SSN = re.compile(r'\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b')
IBAN = re.compile(r'\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b')
SORT_CODE_ACCOUNT = re.compile(r'\b\d{2}-\d{2}-\d{2}\b.{0,20}?\b\d{8}\b', re.S)

def pii_kinds(text: str) -> list[str]:
    """Which kinds of personal data the text appears to contain."""
    kinds = []
    if EMAIL.search(text):
        kinds.append('email')
    for m in PHONE.finditer(text):
        n = len(_digits(m.group()))
        if 10 <= n <= 15:
            kinds.append('phone')
            break
    for m in CARD.finditer(text):
        d = _digits(m.group())
        if 13 <= len(d) <= 19 and _luhn(d):
            kinds.append('card')
            break
    if NI_NUMBER.search(text):
        kinds.append('ni_number')
    if US_SSN.search(text):
        kinds.append('ssn')
    if IBAN.search(text) or SORT_CODE_ACCOUNT.search(text):
        kinds.append('bank_account')
    return kinds

def detect_pii(text: str) -> bool:
    return bool(pii_kinds(text))

def detect_hate_speech(text: str) -> bool:
    if not toxicity_model:
        return False
    try:
        results = toxicity_model.predict(text)
        # Check toxicity broadly: general toxicity, identity attacks, threats, insults
        return (
            results.get('toxicity', 0) > 0.7 or
            results.get('severe_toxicity', 0) > 0.4 or
            results.get('identity_attack', 0) > 0.4 or
            results.get('threat', 0) > 0.4 or
            results.get('insult', 0) > 0.7
        )
    except Exception as e:
        logger.warning(f'Detoxify error: {e}')
        return False

# ── Auth middleware ───────────────────────────────────────────────────────────

@app.before_request
def check_api_key():
    if request.endpoint == 'health' or request.method == 'OPTIONS':
        return
    if API_KEY and request.headers.get('X-Api-Key') != API_KEY:
        return jsonify({'error': 'Forbidden'}), 403

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/moderate', methods=['POST'])
def moderate():
    data = request.get_json(silent=True) or {}
    text = str(data.get('text', '')).strip()

    if not text:
        return jsonify({'error': 'text is required'}), 400
    if len(text) > 10_000:
        return jsonify({'error': 'text too long (max 10,000 chars)'}), 400

    flags: list[str] = []
    try:
        if profanity_checker and profanity_checker.contains_profanity(text):
            flags.append('profanity')
        if detect_pii(text):
            flags.append('pii')
        if detect_hate_speech(text):
            flags.append('hate_speech')
    except Exception as e:
        logger.error(f'Scan error: {e}', exc_info=True)
        return jsonify({'error': 'scan failed'}), 500

    return jsonify({'flagged': len(flags) > 0, 'flags': flags})

@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'profanity': profanity_checker is not None,
        'detoxify':  toxicity_model is not None,
        'timestamp': datetime.utcnow().isoformat(),
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
