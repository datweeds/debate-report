import type { Metadata } from 'next';
import { LegalPage, Card, Bullets, A, B } from '@/lib/legalPage';

export const metadata: Metadata = {
  title: 'Proving your age',
  description: 'Why new.vote sometimes asks you to confirm your age, the ways you can, and what each means for your privacy.',
};

export default function AgeCheckGuide() {
  return (
    <LegalPage
      crumbs={[{ href: '/', label: 'Home' }, { href: '/guides', label: 'Guides' }, { label: 'Proving your age' }]}
      title="Proving your age"
      updated="24 November 2026"
      intro={<p>Why we sometimes ask you to confirm your age, the ways you can, and what each one means for your privacy.</p>}
    >
      <Card title="Why we ask">
        <Bullets items={[
          <>UK law, the <span className={B}>Online Safety Act</span>, requires sites that young people may use to protect them. new.vote is for people aged 16 and over.</>,
          <>For features that could put adults and young people in touch locally, such as joining a local Society, saying your age isn’t enough: we have to check it reliably.</>,
          <>We also ask if you move your age group up to 18 or over, or if something suggests the age group on your account may be wrong.</>,
          <>Most members are never asked.</>,
        ]} />
      </Card>
      <Card title="Your choices, most private first">
        <Bullets items={[
          <><span className={B}>A digital wallet on your phone.</span> You share only yes/no answers, such as “over 18”.</>,
          <><span className={B}>A face check on your own device.</span> It estimates your age; your face never leaves your phone or computer.</>,
          <><span className={B}>Another way.</span> If neither suits you, <a href="/contact" className={A}>contact us</a>.</>,
        ]} />
      </Card>
      <Card title="Using Google Wallet (Android phones)">
        <Bullets items={[
          <>Install Google Wallet from the Play Store, if you don’t have it.</>,
          <>Add an <span className={B}>ID pass</span> from your UK passport: Wallet guides you to scan the passport’s chip and take a short video selfie, once.</>,
          <>On new.vote, choose <span className={B}>Prove with a wallet</span>. On a computer, scan the code your browser shows with your phone.</>,
          <>Your phone shows exactly what we’re asking for, such as “Over 18: yes/no”. Approve it.</>,
          <><span className={B}>iPhone:</span> Apple Wallet can’t do this in the UK yet, so please use the face check.</>,
        ]} />
      </Card>
      <Card title="What you gain">
        <Bullets items={[
          <>We learn only “yes” or “no”: not your name, date of birth, photo or passport number.</>,
          <>It takes seconds, and you can use your wallet again elsewhere.</>,
        ]} />
      </Card>
      <Card title="The privacy risks, honestly">
        <Bullets items={[
          <><span className={B}>The wallet company holds your passport details</span> once you add an ID pass. That’s between you and them, under their privacy policy.</>,
          <><span className={B}>Your wallet can see that new.vote asked.</span> It doesn’t see what you post here. If that bothers you, use the face check.</>,
          <>With most wallets today, each answer carries the same issuer signature, so in principle two answers could be linked. We don’t keep them, so we can’t.</>,
          <><span className={B}>On a shared or lost phone</span>, anyone who can unlock it could use your wallet. Keep a screen lock on.</>,
        ]} />
      </Card>
      <Card title="What we keep">
        <p>Your age group (16 or 17, or 18 or over), how it was checked, and the date. Nothing else: no selfie, no ID, no wallet answer.</p>
      </Card>
    </LegalPage>
  );
}
