// Same output as scripts/emails.py, for pasting into the Supabase dashboard console.
(() => {
const SITE='https://whossup.app',PINK='#ec4899',PURPLE='#7c5cff',INK='#14101f',MUTED='#6b6880',LINE='#ebe8f2',BG='#f4f2f8';
const FONT="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
const email=({preheader,title,intro,button,link_var,after,why})=>`<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 20px;">
        <a href="${SITE}" style="text-decoration:none;">
          <img src="${SITE}/img/mark.png" width="44" height="44" alt="Whossup" style="display:inline-block;vertical-align:middle;border:0;border-radius:12px;">
          <span style="display:inline-block;vertical-align:middle;margin-left:10px;font:700 24px/1 ${FONT};color:${INK};letter-spacing:-0.5px;">whos<span style="color:${PINK};">sup</span></span>
        </a>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:20px;padding:36px 32px;">
        <h1 style="margin:0 0 12px;font:700 26px/1.2 ${FONT};color:${INK};letter-spacing:-0.5px;">${title}</h1>
        <p style="margin:0 0 26px;font:400 16px/1.55 ${FONT};color:#3b3a4a;">${intro}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" bgcolor="${PINK}" style="border-radius:999px;background:${PINK};background-image:linear-gradient(90deg,${PURPLE},${PINK} 60%,#fb7185);">
            <a href="{{ ${link_var} }}" target="_blank" style="display:inline-block;padding:15px 30px;font:600 16px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:999px;">${button}</a>
          </td></tr>
        </table>
        <p style="margin:26px 0 0;font:400 14px/1.55 ${FONT};color:${MUTED};">${after}</p>
        <p style="margin:18px 0 0;font:400 13px/1.5 ${FONT};color:${MUTED};">Button not working? Copy this link into your browser:<br>
          <a href="{{ ${link_var} }}" style="color:${PURPLE};word-break:break-all;">{{ ${link_var} }}</a></p>
      </td></tr>
      <tr><td style="padding:22px 8px 0;font:400 12.5px/1.55 ${FONT};color:${MUTED};text-align:center;">
        ${why}<br>
        <a href="${SITE}" style="color:${MUTED};">whossup.app</a> · Find the day everyone’s free
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
const L='.ConfirmationURL';
window.WHOSSUP_EMAILS={
 'confirm-signup':{subject:'Confirm your email for Whossup',html:email({preheader:"One tap and you're in — then find the day everyone's free.",title:'Welcome to Whossup 👋',intro:'Thanks for signing up! Confirm your email and you’re in — mark your busy days, and Whossup shows when your whole crew is free.',button:'Confirm my email',link_var:L,after:'This link works once and expires in 24 hours.',why:'You’re getting this because this address was used to sign up at Whossup. Didn’t sign up? Just ignore this email.'})},
 'magic-link':{subject:'Your Whossup sign-in link',html:email({preheader:'Tap to sign in — no password needed.',title:'Sign in to Whossup',intro:'Tap the button below to sign in. No password needed.',button:'Sign me in',link_var:L,after:'For your security the link works once and expires in 1 hour. Open it on the device where you want to be signed in.',why:'Someone asked to sign in to Whossup with this address. If it wasn’t you, you can safely ignore this email.'})},
 'reset-password':{subject:'Reset your Whossup password',html:email({preheader:'Choose a new password in one tap.',title:'Reset your password',intro:'We got a request to reset the password for your Whossup account. Tap below to choose a new one.',button:'Choose a new password',link_var:L,after:'The link expires in 1 hour. If you didn’t ask for this, your password stays the same.',why:'You’re getting this because a password reset was requested for this address at Whossup.'})},
 'change-email':{subject:'Confirm your new email for Whossup',html:email({preheader:'Confirm the change and you\'re done.',title:'Confirm your new email',intro:'Tap below to confirm <b>{{ .NewEmail }}</b> as the email for your Whossup account.',button:'Confirm new email',link_var:L,after:'Until you confirm, you’ll keep signing in with {{ .Email }}.',why:'Didn’t ask to change your email? Ignore this message — nothing will change.'})},
 'invite':{subject:'You’re invited to Whossup',html:email({preheader:"Your friends are planning — see when everyone's free.",title:'You’re invited 🎉',intro:'Someone invited you to join them on Whossup — the easy way for a group of friends to find the day everyone’s free.',button:'Accept invite',link_var:L,after:'It takes a few seconds: pick a name, mark your busy days, done.',why:'You’re getting this because someone invited this address to Whossup. Not interested? Just ignore this email.'})},
};
})();
