import { LegalPage } from "@/components/legal/LegalPage";

/* THE PRIVACY POLICY OF ROW, the phone app and rowtember.com (2026-11-21;
 * the owner, of what the App Store asks for: "Do all the items to get it
 * Apple App Store ready"). The store listing links here, so the page is
 * public from the day it is made: a policy nobody can read is not one. It
 * says what the code does today; change the two together. */
export const metadata = {
  title: "Privacy · ROW",
  robots: { index: false, follow: false },
};

const MAIL = "row@rowtember.com";

export default function Page() {
  return (
    <LegalPage title="Privacy policy" accent="policy" effective="2026-11-21">
      <p>
        This covers ROW, the rowing app, and the Rowtember website at rowtember.com. The short version: we keep what you log and what you choose to post, we show it to other rowers the way your settings
        say, we do not sell any of it, and you can delete your account from inside the app.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account.</strong> When you sign in with Google or with Apple we receive your name and your email address. With Apple that can be a private relay address.
        </li>
        <li>
          <strong>What you log.</strong> Each row: its meters, its time, the day, a title and a description if you write one, and the photos you attach to it.
        </li>
        <li>
          <strong>Telemetry from your rowing machine.</strong> When you connect a Concept2 monitor over Bluetooth, the app records what the monitor sends during the row: pace, stroke rate, power, force
          curves, heart rate when the monitor has a strap paired, drag factor, and the monitor&rsquo;s name and serial number. It is saved with the row.
        </li>
        <li>
          <strong>Your profile.</strong> A profile photo and a bio if you add them, and your Instagram handle if you gave one. These are shown to other rowers.
        </li>
        <li>
          <strong>Details only you see.</strong> Your birthday, height and weight, if you enter them. They are not shown to anyone else.
        </li>
        <li>
          <strong>What you do in the app.</strong> Who you follow, the rows you like, the comments you write, who you block or mute, and the reports you send.
        </li>
        <li>
          <strong>A push token,</strong> if you allow notifications, so a notification can reach your phone.
        </li>
        <li>
          <strong>Basic technical data.</strong> Standard server logs (IP address, the page or route asked for, the time) for security and for fixing faults.
        </li>
      </ul>

      <h2>What we do not collect</h2>
      <ul>
        <li>We do not track your location. Bluetooth is used only to talk to the rowing machine.</li>
        <li>We do not run advertising or third-party marketing trackers.</li>
        <li>We do not sell or rent your data.</li>
      </ul>

      <h2>Who sees what</h2>
      <p>
        Your name, rower number, meters and your place on the board are visible to everyone. With a public account your rows, photos, description, likes and comments are visible to everyone too. With a
        private account, which you can turn on in Settings, your rows and photos are shown only to followers you accept. A rower you block does not see your rows or your page.
      </p>

      <h2>Who we share data with</h2>
      <ul>
        <li>
          <strong>Google and Apple</strong>, to sign you in.
        </li>
        <li>
          <strong>Vercel</strong> (hosting), <strong>Neon</strong> (the database) and <strong>Cloudflare</strong> (photo storage), which hold the data on our behalf.
        </li>
        <li>
          <strong>Expo and Apple or Google</strong>, to deliver a push notification to your phone when you have allowed them.
        </li>
        <li>
          <strong>Resend</strong>, to send email.
        </li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        In the app: Settings, Account, Delete account. That removes your rower, every row you logged, your photos&rsquo; records, your follows, likes, comments, notifications, settings and saved
        telemetry. Reports made about an account are kept. You can also remove a single row from its own page, or write to <a href={`mailto:${MAIL}`}>{MAIL}</a> and we will do it for you within 30 days.
      </p>

      <h2>Children</h2>
      <p>ROW is not directed at children under 13, and we do not knowingly collect personal data from anyone under 13. If you believe we have, write to us and we will delete it.</p>

      <h2>Security</h2>
      <p>Data is encrypted in transit (HTTPS) and at rest with our hosting providers. No system is perfectly secure; if a breach affects your data we will tell you by email.</p>

      <h2>Changes</h2>
      <p>When this policy changes, the date at the top changes with it.</p>

      <h2>Contact</h2>
      <p>
        Questions or requests about your data: <a href={`mailto:${MAIL}`}>{MAIL}</a>.
      </p>
    </LegalPage>
  );
}
