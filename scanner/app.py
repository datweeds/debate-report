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
nlp = None
toxicity_model = None

try:
    from better_profanity import profanity as _prof
    _prof.load_censor_words()
    profanity_checker = _prof
    logger.info('better_profanity loaded')
except Exception as e:
    logger.warning(f'better_profanity unavailable: {e}')

try:
    import spacy
    nlp = spacy.load('en_core_web_sm')
    logger.info('spaCy loaded')
except Exception as e:
    logger.warning(f'spaCy unavailable: {e}')

try:
    from detoxify import Detoxify
    toxicity_model = Detoxify('original')
    logger.info('Detoxify loaded')
except Exception as e:
    logger.warning(f'Detoxify unavailable: {e}')

# ── PII regex patterns ────────────────────────────────────────────────────────

PII_PATTERNS = {
    'email':       re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'),
    'phone':       re.compile(r'\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b'),
    'ssn':         re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    'credit_card': re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b'),
}

def detect_pii(text: str) -> bool:
    # Regex-first: catches concrete structured PII reliably
    for pattern in PII_PATTERNS.values():
        if pattern.search(text):
            return True
    # NER: flag named persons only (orgs/locations are too noisy for debate content)
    if nlp:
        try:
            doc = nlp(text)
            if any(ent.label_ == 'PERSON' for ent in doc.ents):
                return True
        except Exception as e:
            logger.warning(f'NER error: {e}')
    return False

def detect_hate_speech(text: str) -> bool:
    if not toxicity_model:
        return False
    try:
        results = toxicity_model.predict(text)
        return results['identity_attack'] > 0.5 or results['threat'] > 0.5
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
        'spacy':     nlp is not None,
        'detoxify':  toxicity_model is not None,
        'timestamp': datetime.utcnow().isoformat(),
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
