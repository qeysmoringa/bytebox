(function () {
  'use strict';
  /* The publishable key is MEANT to be public. Your data is protected by the database rules (RLS), not by hiding this key. */
  var SUPABASE_URL = 'https://qtrqkygwkjwblkztrmcu.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_DnCC3kyDv7KH_PZIM1HI-Q_rkoEPldH';
  var PER_PAGE = 10;

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  // a second client that never stores anything: used only to double-check a password
  var checker = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  var BASE = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');

  var recovery = false;
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') { recovery = true; if (window.__onRecovery) window.__onRecovery(); }
  });

  /* ---------- small helpers (everything user-made goes through textContent: no HTML injection) ---------- */
  function $(s) { return document.querySelector(s); }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) { var kid = arguments[i]; if (Array.isArray(kid)) kid.forEach(function (k) { if (k != null) n.append(k); }); else if (kid != null) n.append(kid); }
    return n;
  }
  function go(url) { location.href = url; }
  function day(iso) { return new Date(iso).toISOString().slice(0, 10); }
  function notify(kind, text) {
    var box = $('#msg'); if (!box) return;
    box.replaceChildren();
    var items = Array.isArray(text) ? text : [text];
    var n = el('div', { class: kind === 'ok' ? 'notice' : 'error', role: kind === 'ok' ? 'status' : 'alert' });
    if (items.length === 1) n.textContent = items[0];
    else n.append(el('ul', {}, items.map(function (t) { return el('li', { text: t }); })));
    box.append(n);
    n.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function clearMsg() { var b = $('#msg'); if (b) b.replaceChildren(); }
  function busy(form, on) { var b = form.querySelector('button[type=submit]'); if (b) b.disabled = on; }
  function friendly(error) {
    var m = (error && error.message) || '';
    if (/already registered|already been registered/i.test(m)) return 'That email is already in use.';
    if (/database error|username/i.test(m)) return 'That username is already taken or not allowed.';
    if (/rate limit|too many/i.test(m)) return 'Too many tries right now. Please wait a little and try again.';
    if (/row-level security/i.test(m)) return 'Please finish two-step verification: log out and log in again.';
    if (/slow down/i.test(m)) return m;
    if (/password/i.test(m)) return m;
    return 'Something went wrong. Please try again.';
  }
  var COMMON = ['password', 'qwerty', '123456', 'letmein', 'welcome', 'admin', 'iloveyou', 'bytebox'];
  function passwordErrors(pw, username) {
    var e = [], low = pw.toLowerCase();
    if (pw.length < 12) e.push('At least 12 characters');
    if (pw.length > 72) e.push('No more than 72 characters');
    if (!/[a-z]/.test(pw)) e.push('At least one lowercase letter');
    if (!/[A-Z]/.test(pw)) e.push('At least one uppercase letter');
    if (!/[0-9]/.test(pw)) e.push('At least one number');
    if (!/[^A-Za-z0-9]/.test(pw)) e.push('At least one symbol (e.g. !@#$%)');
    if (COMMON.some(function (c) { return low.indexOf(c) >= 0; })) e.push('Must not contain common words like "password"');
    if (username && low.indexOf(username.toLowerCase()) >= 0) e.push('Must not contain your username');
    return e;
  }
  // text with ``` code blocks, built with textContent only
  function rich(text) {
    var frag = document.createDocumentFragment();
    String(text).split('```').forEach(function (part, i) {
      if (i % 2 === 1) {
        frag.append(el('pre', { class: 'code' }, el('code', { text: part.replace(/^[A-Za-z0-9+#.-]*\r?\n/, '').replace(/\s+$/, '') })));
      } else {
        var t = part.replace(/^\s*\n|\s+$/g, '');
        if (t) frag.append(el('div', { class: 'body-text', text: t }));
      }
    });
    return frag;
  }
  async function needsMfa() {
    var r = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return !!(r.data && r.data.nextLevel === 'aal2' && r.data.currentLevel !== 'aal2');
  }
  async function totpFactors() {
    var r = await sb.auth.mfa.listFactors();
    return ((r.data && r.data.all) || []).filter(function (f) { return f.factor_type === 'totp'; });
  }

  /* ---------- header ---------- */
  function renderHeader(session) {
    var links = [['Home', 'index.html'], ['About', 'index.html#about'], ['Services', 'index.html#services'], ['Discussions', 'discussions.html'], ['Contact', 'index.html#contact']];
    var auth = el('div', { class: 'auth' });
    if (session) {
      var name = (session.user.user_metadata && session.user.user_metadata.username) || session.user.email;
      auth.append(el('a', { class: 'who', href: 'account.html', text: name }),
        el('button', { class: 'btn-ghost', type: 'button', text: 'Log out', onclick: async function () { await sb.auth.signOut(); go('index.html'); } }));
    } else {
      auth.append(el('a', { class: 'btn btn-ghost', href: 'login.html', text: 'Log in' }), el('a', { class: 'btn', href: 'signup.html', text: 'Sign up' }));
    }
    $('#site-header').replaceChildren(el('div', { class: 'container header' },
      el('a', { class: 'logo', href: 'index.html' }, el('span', { class: 'logo-mark', text: '</>' }), el('span', { class: 'logo-text', text: 'ByteBox' })),
      el('nav', {}, el('ul', {}, links.map(function (l) { return el('li', {}, el('a', { href: l[1], text: l[0] })); })), auth)));
  }

  var pages = {};

  /* ---------- sign up ---------- */
  pages.signup = async function (session) {
    if (session) return go('index.html');
    $('#signup-form').addEventListener('submit', async function (e) {
      e.preventDefault(); clearMsg();
      var f = e.target, username = f.elements.username.value.trim(), email = f.elements.email.value.trim().toLowerCase(), pw = f.elements.password.value, errs = [];
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) errs.push('Username must be 3-20 letters, numbers or underscores.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push('Please enter a valid email address.');
      if (pw !== f.elements.confirm.value) errs.push('Passwords do not match.');
      var pe = passwordErrors(pw, username);
      if (pe.length) errs.push('Password needs: ' + pe.join('; ') + '.');
      if (errs.length) return notify('error', errs);
      busy(f, true);
      var r = await sb.auth.signUp({ email: email, password: pw, options: { data: { username: username }, emailRedirectTo: BASE + 'login.html' } });
      busy(f, false);
      if (r.error) return notify('error', friendly(r.error));
      if (r.data.session) return go('index.html');
      f.reset();
      notify('ok', 'Almost there! Check your email and click the confirmation link, then log in.');
    });
  };

  /* ---------- log in (+ 2FA step) ---------- */
  pages.login = async function (session) {
    var loginForm = $('#login-form'), mfaForm = $('#mfa-form');
    function showMfa() { loginForm.hidden = true; mfaForm.hidden = false; $('#msg').replaceChildren(); mfaForm.elements.code.focus(); }
    if (session) { if (await needsMfa()) showMfa(); else return go('index.html'); }
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault(); clearMsg();
      var f = e.target; busy(f, true);
      var r = await sb.auth.signInWithPassword({ email: f.elements.email.value.trim().toLowerCase(), password: f.elements.password.value });
      busy(f, false);
      if (r.error) return notify('error', /not confirmed/i.test(r.error.message) ? 'Please confirm your email first. Check your inbox.' : 'Invalid login details, or too many attempts. Please try again later.');
      if (await needsMfa()) return showMfa();
      go('index.html');
    });
    mfaForm.addEventListener('submit', async function (e) {
      e.preventDefault(); clearMsg();
      var f = e.target, code = f.elements.code.value.replace(/\s/g, '');
      var factor = (await totpFactors()).filter(function (x) { return x.status === 'verified'; })[0];
      if (!factor || !/^\d{6}$/.test(code)) return notify('error', 'Enter the 6-digit code from your authenticator app.');
      busy(f, true);
      var r = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code });
      busy(f, false);
      if (r.error) return notify('error', 'That code is not valid. Try again.');
      go('index.html');
    });
    $('#mfa-cancel').addEventListener('click', async function () { await sb.auth.signOut(); location.reload(); });
  };

  /* ---------- forgot / reset password ---------- */
  pages.forgot = async function () {
    $('#forgot-form').addEventListener('submit', async function (e) {
      e.preventDefault(); clearMsg();
      var f = e.target; busy(f, true);
      await sb.auth.resetPasswordForEmail(f.elements.email.value.trim().toLowerCase(), { redirectTo: BASE + 'reset.html' });
      busy(f, false);
      notify('ok', 'If that email has an account, a reset link is on its way.'); // same message either way
    });
  };
  pages.reset = async function () {
    var form = $('#reset-form');
    function show() { form.hidden = false; $('#reset-wait').hidden = true; }
    if (recovery) show(); else {
      window.__onRecovery = show;
      setTimeout(function () { if (form.hidden) $('#reset-wait').textContent = 'This reset link is invalid or has expired. Please request a new one.'; }, 4000);
    }
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); clearMsg();
      var pw = form.elements.password.value, errs = passwordErrors(pw, '');
      if (pw !== form.elements.confirm.value) errs.push('Passwords do not match');
      if (errs.length) return notify('error', 'Password needs: ' + errs.join('; ') + '.');
      busy(form, true);
      var r = await sb.auth.updateUser({ password: pw });
      busy(form, false);
      if (r.error) return notify('error', friendly(r.error));
      notify('ok', 'Password changed. Taking you to the login page...');
      await sb.auth.signOut({ scope: 'global' });
      setTimeout(function () { go('login.html'); }, 1800);
    });
  };

  /* ---------- account: change password + 2FA ---------- */
  pages.account = async function (session) {
    if (!session) return go('login.html');
    var email = session.user.email;
    $('#acct-name').textContent = (session.user.user_metadata && session.user.user_metadata.username) || '';
    $('#acct-email').textContent = email;

    $('#pw-form').addEventListener('submit', async function (e) {
      e.preventDefault(); clearMsg();
      var f = e.target, pw = f.elements.password.value;
      var errs = passwordErrors(pw, $('#acct-name').textContent);
      if (pw !== f.elements.confirm.value) errs.push('The new passwords do not match');
      if (pw === f.elements.current.value) errs.push('The new password must be different from the old one');
      if (errs.length) return notify('error', 'New password needs: ' + errs.join('; ') + '.');
      busy(f, true);
      var chk = await checker.auth.signInWithPassword({ email: email, password: f.elements.current.value });
      if (chk.error) { busy(f, false); return notify('error', 'Your current password is not correct.'); }
      var r = await sb.auth.updateUser({ password: pw });
      busy(f, false);
      if (r.error) return notify('error', /aal2|reauth|recent/i.test(r.error.message) ? 'For safety, please log out, log in again (with your 2FA code), then change your password.' : friendly(r.error));
      await sb.auth.signOut({ scope: 'others' }); // log out every other device
      f.reset();
      notify('ok', 'Password changed. All other devices were logged out.');
    });

    async function draw2fa() {
      var box = $('#twofa'); box.replaceChildren();
      var all = await totpFactors();
      var verified = all.filter(function (x) { return x.status === 'verified'; });
      if (verified.length) {
        var f = el('form', { class: 'card-form' },
          el('label', { for: 'off-code', text: 'Authenticator code (to turn 2FA off)' }),
          el('input', { id: 'off-code', name: 'code', required: true, maxlength: '6', inputmode: 'numeric', autocomplete: 'one-time-code' }),
          el('button', { class: 'btn-danger', type: 'submit', text: 'Turn off 2FA' }));
        f.addEventListener('submit', async function (e) {
          e.preventDefault(); clearMsg();
          var code = f.elements.code.value.replace(/\s/g, '');
          var v = await sb.auth.mfa.challengeAndVerify({ factorId: verified[0].id, code: code });
          if (v.error) return notify('error', 'That code is not valid.');
          for (var i = 0; i < all.length; i++) await sb.auth.mfa.unenroll({ factorId: all[i].id });
          notify('ok', 'Two-step verification is now off.');
          draw2fa();
        });
        box.append(el('p', {}, 'Two-step verification is ', el('b', { class: 'on', text: 'ON' }), '. Tip: add a second device so you are never locked out.'), f,
          el('div', { class: 'row-actions' }, el('button', { class: 'btn-ghost', type: 'button', text: 'Add another device', onclick: function () { startEnroll(false); } })));
      } else {
        box.append(el('p', {}, 'Two-step verification is ', el('b', { class: 'off', text: 'OFF' }), '. It protects your account even if your password leaks. Highly recommended.'),
          el('button', { type: 'button', text: 'Set up 2FA', onclick: function () { startEnroll(true); } }));
      }
    }
    async function startEnroll() {
      clearMsg();
      var all = await totpFactors();
      for (var i = 0; i < all.length; i++) if (all[i].status !== 'verified') await sb.auth.mfa.unenroll({ factorId: all[i].id }); // clean up half-finished setups
      var r = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'ByteBox ' + new Date().toISOString().slice(0, 16) });
      if (r.error) return notify('error', friendly(r.error));
      var box = $('#twofa'); box.replaceChildren();
      var f = el('form', { class: 'card-form' },
        el('label', { for: 'on-code', text: '6-digit code from the app' }),
        el('input', { id: 'on-code', name: 'code', required: true, maxlength: '6', inputmode: 'numeric', autocomplete: 'one-time-code' }),
        el('button', { type: 'submit', text: 'Turn on 2FA' }));
      f.addEventListener('submit', async function (e) {
        e.preventDefault(); clearMsg();
        var v = await sb.auth.mfa.challengeAndVerify({ factorId: r.data.id, code: f.elements.code.value.replace(/\s/g, '') });
        if (v.error) return notify('error', 'That code is not right. Check the app and try again.');
        notify('ok', 'Two-step verification is now protecting your account.');
        draw2fa();
      });
      box.append(el('p', { text: '1. Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy...). 2. Scan this code or type the key. 3. Enter the 6-digit code.' }),
        el('img', { class: 'qr', src: r.data.totp.qr_code, alt: 'QR code for your authenticator app', width: '220', height: '220' }),
        el('p', { class: 'hint' }, 'Can\u2019t scan? Key: ', el('code', { text: r.data.totp.secret })), f);
    }
    draw2fa();
  };

  /* ---------- discussions list ---------- */
  pages.discussions = async function (session) {
    var params = new URLSearchParams(location.search);
    var q = (params.get('q') || '').replace(/[%_,()*\\":;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    var page = Math.max(1, Math.min(1000, parseInt(params.get('page'), 10) || 1));
    $('#q').value = q;
    if (session) $('#new-btn').hidden = false; else $('#login-hint').hidden = false;
    var from = (page - 1) * PER_PAGE;
    var query = sb.from('threads').select('id,title,created_at,profiles(username),replies(count)', { count: 'exact' })
      .order('id', { ascending: false }).range(from, from + PER_PAGE - 1);
    if (q) query = query.or('title.ilike."*' + q + '*",body.ilike."*' + q + '*"');
    var r = await query;
    var list = $('#list'); list.replaceChildren();
    if (r.error) return list.append(el('p', { text: 'Could not load discussions right now. Please try again.' }));
    if (!r.data.length) list.append(el('p', { text: q ? 'No discussions match your search.' : 'No discussions yet. Be the first to start one!' }));
    r.data.forEach(function (t) {
      var n = t.replies && t.replies[0] ? t.replies[0].count : 0;
      list.append(el('div', { class: 'thread' },
        el('h3', {}, el('a', { href: 'thread.html?id=' + t.id, text: t.title })),
        el('span', { class: 'meta', text: 'by ' + (t.profiles ? t.profiles.username : 'unknown') + ' on ' + day(t.created_at) + ' \u00b7 ' + n + (n === 1 ? ' reply' : ' replies') })));
    });
    var pages_ = Math.max(1, Math.ceil((r.count || 0) / PER_PAGE));
    function link(n) { return 'discussions.html?' + (q ? 'q=' + encodeURIComponent(q) + '&' : '') + 'page=' + n; }
    if (pages_ > 1) {
      $('#pager').replaceChildren(
        page > 1 ? el('a', { class: 'btn btn-ghost', href: link(page - 1), text: '\u2190 Newer' }) : el('span'),
        el('span', { class: 'meta', text: 'Page ' + page + ' of ' + pages_ }),
        page < pages_ ? el('a', { class: 'btn btn-ghost', href: link(page + 1), text: 'Older \u2192' }) : el('span'));
    }
  };

  /* ---------- new discussion ---------- */
  pages.newthread = async function (session) {
    if (!session) return go('login.html');
    $('#thread-form').addEventListener('submit', async function (e) {
      e.preventDefault(); clearMsg();
      var f = e.target, title = f.elements.title.value.trim(), body = f.elements.body.value.trim(), errs = [];
      if (title.length < 5 || title.length > 120) errs.push('Title must be 5-120 characters.');
      if (body.length < 10 || body.length > 5000) errs.push('Body must be 10-5000 characters.');
      if (errs.length) return notify('error', errs);
      busy(f, true);
      var r = await sb.from('threads').insert({ title: title, body: body }).select('id').single();
      busy(f, false);
      if (r.error) return notify('error', friendly(r.error));
      go('thread.html?id=' + r.data.id);
    });
  };

  /* ---------- one discussion ---------- */
  pages.thread = async function (session) {
    var id = parseInt(new URLSearchParams(location.search).get('id'), 10);
    var root = $('#thread');
    function missing() { root.replaceChildren(el('h2', { text: 'Discussion not found' }), el('p', {}, el('a', { href: 'discussions.html', text: 'Back to discussions' }))); }
    if (!id) return missing();
    var me = session ? session.user.id : null;
    var t = await sb.from('threads').select('id,title,body,created_at,user_id,profiles(username)').eq('id', id).maybeSingle();
    if (t.error || !t.data) return missing();
    var d = t.data;
    document.title = d.title + ' | ByteBox';
    var rep = await sb.from('replies').select('id,body,created_at,user_id,profiles(username)').eq('thread_id', id).order('id', { ascending: true });
    var replies = rep.data || [];
    function delBtn(fn) { return el('button', { class: 'btn-danger btn-sm', type: 'button', text: 'Delete', onclick: fn }); }
    root.replaceChildren(
      el('p', {}, el('a', { href: 'discussions.html', text: '\u2190 All discussions' })),
      el('h2', { text: d.title }),
      el('div', { class: 'reply-head' },
        el('span', { class: 'meta', text: 'by ' + (d.profiles ? d.profiles.username : 'unknown') + ' on ' + day(d.created_at) }),
        d.user_id === me ? delBtn(async function () { var r = await sb.from('threads').delete().eq('id', id); if (r.error) return notify('error', friendly(r.error)); go('discussions.html'); }) : null),
      rich(d.body),
      el('h3', { text: replies.length + (replies.length === 1 ? ' reply' : ' replies') }));
    replies.forEach(function (r) {
      root.append(el('div', { class: 'reply' },
        el('div', { class: 'reply-head' },
          el('span', { class: 'meta', text: (r.profiles ? r.profiles.username : 'unknown') + ' on ' + day(r.created_at) }),
          r.user_id === me ? delBtn(async function () { var x = await sb.from('replies').delete().eq('id', r.id); if (x.error) return notify('error', friendly(x.error)); location.reload(); }) : null),
        rich(r.body)));
    });
    if (!session) return root.append(el('p', {}, el('a', { href: 'login.html', text: 'Log in' }), ' to reply.'));
    var f = el('form', { class: 'card-form' },
      el('label', { for: 'reply-body', text: 'Your reply' }),
      el('textarea', { id: 'reply-body', name: 'body', rows: '5', required: true, minlength: '2', maxlength: '5000' }),
      el('p', { class: 'hint', text: 'Share code between three backticks: ``` your code ```' }),
      el('button', { type: 'submit', text: 'Reply' }));
    f.addEventListener('submit', async function (e) {
      e.preventDefault(); clearMsg();
      var body = f.elements.body.value.trim();
      if (body.length < 2) return notify('error', 'Please write a reply.');
      busy(f, true);
      var r = await sb.from('replies').insert({ thread_id: id, body: body });
      busy(f, false);
      if (r.error) return notify('error', friendly(r.error));
      location.reload();
    });
    root.append(f);
  };

  /* ---------- start ---------- */
  (async function init() {
    var s = (await sb.auth.getSession()).data.session;
    renderHeader(s);
    var fn = pages[document.body.getAttribute('data-page')];
    if (fn) { try { await fn(s); } catch (err) { console.error(err); notify('error', 'Something went wrong. Please refresh the page.'); } }
  })();
})();
