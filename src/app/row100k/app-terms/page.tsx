import { LegalPage } from "@/components/legal/LegalPage";

/* THE TERMS OF ROW (2026-11-21). Apple asks an app where people post to
 * one another for terms that say objectionable content and abusive users
 * are not tolerated, a way to report and to block (both are in the app),
 * and somebody acting on reports. Public, like the privacy policy beside
 * it, because the store listing links here. */
export const metadata = {
  title: "Terms · ROW",
  robots: { index: false, follow: false },
};

const MAIL = "row@rowtember.com";

export default function Page() {
  return (
    <LegalPage title="Terms of use" accent="use" effective="2026-11-21">
      <p>These are the terms for ROW, the rowing app, and the Rowtember website at rowtember.com. By making an account you agree to them.</p>

      <h2>Your account</h2>
      <p>You sign in with Google or with Apple. You are responsible for what is done with your account. You must be at least 13 years old.</p>

      <h2>What you post</h2>
      <p>
        The rows, photos, descriptions and comments you post are yours. By posting them you allow us to store them and to show them to other rowers the way your settings say. Log what you rowed: the
        boards only mean something if the meters are real.
      </p>

      <h2>What is not allowed</h2>
      <p>There is no tolerance for objectionable content or abusive behaviour. Do not post:</p>
      <ul>
        <li>harassment, threats or hate directed at anybody;</li>
        <li>nudity or sexual content;</li>
        <li>anything illegal, or anybody else&rsquo;s private information;</li>
        <li>spam, or rows that were not rowed.</li>
      </ul>

      <h2>Reporting and blocking</h2>
      <p>
        Every row, comment and rower can be reported from its three dots, and any rower can be blocked, which hides each of you from the other at once. We review reports within 24 hours, remove what
        breaks these terms, and remove the accounts of people who break them.
      </p>

      <h2>Your health</h2>
      <p>Rowing is hard exercise. ROW records what you do; it is not medical advice and it is not a coach. Talk to a doctor before starting hard training, and stop if something feels wrong.</p>

      <h2>The service</h2>
      <p>
        ROW is provided as it is. We work to keep it running and your data safe, but we cannot promise it will never be down or never lose something. To the extent the law allows, we are not liable for
        losses that come from using it.
      </p>

      <h2>Ending it</h2>
      <p>You can delete your account at any time in the app: Settings, Account, Delete account. We may suspend or remove an account that breaks these terms.</p>

      <h2>Changes</h2>
      <p>When these terms change, the date at the top changes with them.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${MAIL}`}>{MAIL}</a>
      </p>
    </LegalPage>
  );
}
