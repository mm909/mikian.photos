import { LegalPage } from "@/components/legal/LegalPage";

/* THE PRIVACY POLICY OF ROW, the phone app and rowtember.com (2026-11-21;
 * the owner, of what the App Store asks for: "Do all the items to get it
 * Apple App Store ready"). The store listing links here, so the page is
 * public from the day it is made: a policy nobody can read is not one. It
 * says what the code does today; change the two together.
 *
 * 2026-11-23 (the owner: "remove the 'we don't sell any of your data' ...
 * Let's not say that other people don't see your weight, heights and
 * birthday, because we definitely will use them in aggregation ... I do
 * want to collect location data probably for gym ... We will be running
 * advertising ... We'll sell the data if someone's buying it ... But we're
 * not doing that right now"): no promise never to sell or advertise; what
 * is true today is said as today, and a change is promised to be written
 * here before it starts.
 *
 * 2026-11-24 (the owner, of the store's privacy label marking email for
 * marketing: "I mean to send people marketing"; "Yes, add it"): email is
 * also for news about ROW and Rowtember, each one with a way to stop it. */
export const metadata = {
  title: "Privacy · ROW",
  robots: { index: false, follow: false },
};

const MAIL = "row@rowtember.com";

export default function Page() {
  return (
    <LegalPage title="Privacy policy" accent="policy" effective="2026-11-24">
      <p>
        This covers ROW, the rowing app, and the Rowtember website at rowtember.com. The short version: we keep what you log and what you choose to post, we show it to other rowers the way your settings
        say, and you can delete your account from inside the app.
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
          <strong>Your body and age.</strong> Your birthday, height and weight, if you enter them. They are not shown on your page. We use them, together with other rowers&rsquo;, for statistics
          such as age and weight groups.
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
        <li>
          <strong>Rough location.</strong> The app does not ask for your phone&rsquo;s location. We may estimate a rough location, such as a city or the gym you row at, from your IP address and from
          the rowing machine you connect to.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the app: your board, your stats, your feed, notifications and email.</li>
        <li>To email you news about ROW and Rowtember. Every such email has a link to stop them, and stopping them does not affect your account.</li>
        <li>For statistics across rowers, such as averages by age, weight or gym.</li>
        <li>
          Today we do not show advertising and do not sell your data. We may do either in the future, or share data with partners. If we do, we will change this policy, and its date, before it
          starts, and say what is used and with whom.
        </li>
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
