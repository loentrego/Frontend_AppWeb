// ============ LOGIN CON USUARIO Y CONTRASEÑA ============
(() => {
  'use strict';

  const API_LOGIN = 'https://app.loentrego.com/api/login';

  // ⚠️ TEMPORAL: acceso de prueba mientras no hay backend.
  // Entra al panel sin llamar a la API. QUITAR al conectar los endpoints.
  const DEMO_LOGIN = { usuario: 'demo', password: 'demo123', rol: 'stores' };

  const ui = {
    form: document.getElementById('login-form'),
    usuario: document.getElementById('usuario'),
    password: document.getElementById('password'),
    toggle: document.getElementById('toggle-password'),
    error: document.getElementById('login-error'),
    btn: document.getElementById('login-btn'),
  };

  // ---------- Vista ----------
  function setLoginError(msg) {
    if (ui.error) ui.error.textContent = msg || '';
  }

  function shakeForm() {
    if (!ui.form) return;
    ui.form.classList.remove('shake');
    void ui.form.offsetWidth; // reflow para repetir la animación
    ui.form.classList.add('shake');
    setTimeout(() => ui.form.classList.remove('shake'), 400);
  }

  function setLoading(isLoading) {
    if (!ui.btn) return;
    const label = ui.btn.querySelector('.login-btn-text');
    const icon = ui.btn.querySelector('.btn-icon');
    let spinner = ui.btn.querySelector('.spinner');

    ui.btn.disabled = isLoading;
    ui.btn.setAttribute('aria-busy', String(isLoading));
    if (label) label.textContent = isLoading ? 'Ingresando…' : 'Ingresar';
    if (icon) icon.hidden = isLoading;

    if (isLoading && !spinner) {
      spinner = document.createElement('span');
      spinner.className = 'spinner';
      spinner.setAttribute('aria-hidden', 'true');
      ui.btn.prepend(spinner);
    } else if (!isLoading && spinner) {
      spinner.remove();
    }
  }

  function togglePassword() {
    if (!ui.toggle || !ui.password) return;
    const show = ui.password.type === 'password';
    ui.password.type = show ? 'text' : 'password';
    ui.toggle.setAttribute('aria-pressed', String(show));
    ui.toggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  }

  // ---------- Validación contra la API/VPS ----------
  async function iniciarSesion(usuario, password) {
    setLoginError('');

    if (!usuario || !password) {
      setLoginError('Ingresa tu usuario y contraseña');
      shakeForm();
      (usuario ? ui.password : ui.usuario)?.focus();
      return;
    }

    setLoading(true);

    if (usuario === DEMO_LOGIN.usuario && password === DEMO_LOGIN.password) {
      localStorage.setItem('auth_token', 'demo');
      window.location.href = `Pages/Pages-${DEMO_LOGIN.rol}.html`;
      return;
    }

    try {
      const respuesta = await fetch(API_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      });

      const datos = await respuesta.json();

      if (respuesta.ok && datos.rol) {
        if (datos.token) localStorage.setItem('auth_token', datos.token);
        window.location.href = `Pages/Pages-${datos.rol.toLowerCase()}.html`;
      } else {
        setLoginError(datos.mensaje || 'Usuario o contraseña incorrectos');
        shakeForm();
        if (ui.password) {
          ui.password.value = '';
          ui.password.focus();
        }
      }
    } catch (error) {
      console.error('Error en la autenticación:', error);
      setLoginError('Error de conexión con el servidor');
      shakeForm();
    } finally {
      setLoading(false);
    }
  }

  // ---------- Eventos ----------
  document.addEventListener('DOMContentLoaded', () => {
    ui.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      iniciarSesion(ui.usuario?.value.trim() ?? '', ui.password?.value ?? '');
    });

    [ui.usuario, ui.password].forEach((input) => {
      input?.addEventListener('input', () => setLoginError(''));
    });

    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (target?.dataset.action === 'toggle-password') togglePassword();
    });
  });
})();

// Registro del Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('Service Worker registrado correctamente', reg);
    }).catch(err => {
      console.log('Error registrando Service Worker', err);
    });
  });
}
