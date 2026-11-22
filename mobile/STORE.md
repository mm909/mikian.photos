# ROW on the App Store: the listing, ready to paste

Drafted 2026-11-22 from what the app does today (owner: "work on the listing text as well"). Every block is under Apple's limit for its field; the count is beside it. Change the words freely; the limits are the only hard edges.

Lines marked **YOURS** need something only you have.

## The listing

**Name** (30): `ROW`
If the name is taken: `ROW: Rowtember` (14).

**Subtitle** (30): `Log, race and read every row` (28)

**Promotional text** (170, can be changed any time without a review):

> Connect your rowing machine, row, and read what the piece says about you: how steady you were, where your push peaks, and where you stand against everyone else. (160)

**Keywords** (100, commas and no spaces):

```
erg,indoor,rowing,machine,ergometer,split,stroke,rate,100k,challenge,workout,log,pace,force,curve
```
(97) Left out on purpose: `concept2` and `pm5`. They are somebody else's trademarks, and Apple can reject keywords for that. They are in the description, where saying what the app works with is allowed.

**Description** (4,000):

```
ROW is where indoor rowers log their meters, read their rows, and row the 100K.

LOG EVERY ROW
Log a row by hand, or connect a Concept2 PM5 monitor over Bluetooth and let the app read the piece as you row it. Every row takes two photos: you, and the monitor. Your meters add up on your profile for the month and for all time.

ROW WITH THE MONITOR IN YOUR HAND
While you row, the app shows your average pace, your pace now, your meters and your time, and the finish you are on pace for. Set a distance on the monitor and you can race it: your own past rows and the rowers you follow start beside you, and you watch yourself pass them or get passed.

READ THE ROW AFTERWARD
A row recorded from the monitor gets a full read, in plain English and in pictures:
- How steady: two scores out of 100 that are not about speed, one for holding your split and one for repeating the same stroke.
- Pace along the piece, rate and length, the force curve of your average stroke, and the work in every stroke.
- Coaching: up to four things to do on the next row, each one worked out from this row's own numbers.

SEE WHERE YOU STAND
Swipe any chart to lay your row over everyone else's. Is your split steadier than most? Does your push peak earlier or later? Do you take more strokes, or longer ones? Each chart says where you stand and which way is better, and opens a page of questions about what that says about you and how to move it.

THE 100K
Every month, rowers opt in to row 100,000 meters. The board shows who is on pace and who has made it. Stats show the whole field: how far a typical row is, how long a 5K takes, when people row.

FOLLOW ROWERS
A feed of every row, the rowers you follow first. Like, comment, reply and tag. Share a row as a sticker for your story. Keep your account private if you would rather approve who follows you. Block, mute and report are on every rower and every row.

ROWTEMBER
ROW is the home of Rowtember, the September 100K, and of its race day.

YOUR DATA
No location. No advertising. Delete your account, and everything in it, from Settings at any time.

Works with the Concept2 PM5 monitor. Concept2 and PM5 are trademarks of Concept2, Inc.; ROW is not affiliated with Concept2.
```

**What's new** (first version): `The first version of ROW.`

**Category**: Health & Fitness. Secondary: Sports.

**Copyright**: `2026 Mikian Musser`

**URLs**
- Privacy policy: `https://www.rowtember.com/row100k/app-privacy`
- Terms (put it in the description's licence field or leave Apple's standard one): `https://www.rowtember.com/row100k/app-terms`
- Support URL: **YOURS**. Apple wants a page where a person can reach you. The terms page names `row@rowtember.com`; a short support page of its own would be better, and is a new site page.
- Marketing URL (optional): `https://www.rowtember.com`

**Screenshots**: iPhone only (the app is not set up for iPad), at the 6.9 inch size: 1320 by 2868, or 1290 by 2796. Six that tell the app in order:
1. The board, mid-month.
2. The feed, a row with its photo.
3. The monitor's race page, mid-row.
4. A row's analytics: the time, the read, how steady.
5. A chart flipped to AGAINST EVERYONE.
6. A profile.
**YOURS**: taken on your phone, from the live app, so the rows and faces are real.

## Notes for the reviewer

Paste into App Review Information. The two values in angle brackets are the ones you set on the host as `APP_REVIEW_USER` and `APP_REVIEW_PASSWORD` (see "Before you submit").

```
SIGNING IN
The app signs in with Apple or with Google. For review there is also a name and a password:
on the sign-in screen, press "App review sign-in" under the buttons, and enter
  Name: <APP_REVIEW_USER>
  Password: <APP_REVIEW_PASSWORD>
The first time, the app asks you to join as a rower (a name, a division, a birthday). Any values work.

THE ROWING MACHINE
The app reads a Concept2 PM5 rowing machine monitor over Bluetooth. Without one:
press + (top left), then "Run a demo row" under the three steps. A simulated 2,000 m row plays in about 80 seconds.
Swipe sideways for the monitor's other pages. When it ends, press "See its analytics" to open the
full read of that row. A demo row is not saved or posted.
Bluetooth is used only to talk to the rowing machine. The app does not use location.

LOGGING A ROW WITHOUT A MACHINE
Press +, then "Log by hand": meters, time, and two photos from the library or the camera.

USER CONTENT
Rowers post rows with photos, descriptions and comments. On every row and every rower, the three
dots open Report, Block and Mute. Reports are mailed to us at once and acted on within 24 hours;
we can remove a photo, a row or a rower. The terms, linked on the sign-in screen, allow no abusive content.

DELETING AN ACCOUNT
Profile, the menu at the top right, Settings, Account, Delete account.

CONTACT
row@rowtember.com
```

## App Privacy (the "nutrition label")

Answer "Yes, we collect data". Nothing is used for tracking, and nothing is shared with advertisers or data brokers. Every type below is **linked to the user** and collected for **App Functionality**.

| Apple's type | What it is in ROW |
| --- | --- |
| Contact Info: Name | The name from Apple or Google, and the rower's display name |
| Contact Info: Email Address | From Apple or Google (Apple's can be a relay address) |
| User Content: Photos or Videos | The two photos on a row, the profile photo |
| User Content: Other User Content | Row titles and descriptions, comments, the bio |
| Health & Fitness: Fitness | Every row: meters, time, pace, and the monitor's telemetry (rate, power, force curves, heart rate when a strap is paired) |
| Health & Fitness: Health | Height and weight, if the rower enters them (seen only by them) |
| Identifiers: User ID | The account's id |
| Identifiers: Device ID | The push token, if notifications are allowed |
| Usage Data: Product Interaction | Follows, likes, blocks, mutes, reports |
| Other Data | Birthday, if entered |

Not collected: location, contacts, browsing or search history, purchases, financial info, diagnostics from an analytics kit, advertising data.

This matches the privacy page as it reads today. If the page changes, change this with it.

## Age rating

Apple works the rating out from a questionnaire; answer what is true of the app:
- User-generated content: **yes** (rows, photos, comments), with report, block and removal.
- People writing to each other: public comments and replies under rows, **no private messages**.
- Advertising: none. Gambling, contests with money: none. Unrestricted web access: none.
- Violence, sexual content, profanity, drugs, horror, medical treatment: none from us. Fitness tracking only.

Expect something above the lowest rating because of the user content. The privacy page already says ROW is not directed at children under 13.

## Other questions App Store Connect asks

- Export compliance: the app uses only standard HTTPS. `ITSAppUsesNonExemptEncryption` is already `false` in `app.json`, so the question should not come up.
- Sign in with Apple: yes, offered beside Google.
- Advertising identifier: not used.
- Price: no charge to download. When the subscription is sold in the iPhone app it has to be an Apple in-app purchase, set up here with its own review.

## Before you submit

1. **Set the reviewer's sign-in on the host** (Vercel, Production): `APP_REVIEW_USER` (3 characters or more) and `APP_REVIEW_PASSWORD` (8 or more), then redeploy. Until both are set the review sign-in refuses everybody. Take them off after the review to shut it again.
2. **The mailbox** `row@rowtember.com` has to receive mail: the policy, the terms and these notes all name it.
3. **The store build must carry today's code.** It takes updates from the `production` channel: `npx eas-cli@latest update --channel production --environment production --platform ios --non-interactive --message "<what changed>"` from `mobile/`, or a fresh `build --profile production`.
4. **Upload**: `npx eas-cli@latest submit --platform ios`, then try the build in TestFlight before pressing Submit for Review.
5. After the review: delete the "App Review" rower from the three dots on its page, if the reviewer joined as one.
