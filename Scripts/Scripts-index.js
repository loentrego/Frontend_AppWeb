// ============ LOGIN CON USUARIO Y CONTRASEÑA ============

function setLoginError(msg) {
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.textContent = msg || '';
}

function shakeCard() {
  const card = document.querySelector('.login-card');
  if (!card) return;
  card.classList.remove('shake');
  // Forzar reflow para poder repetir la animación
  void card.offsetWidth;
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 400);
}

function setLoading(isLoading) {
  const btn = document.getElementById('login-btn');
  if (!btn) return;
  btn.disabled = isLoading;
  const label = btn.querySelector('.login-btn-text');
  if (label) label.textContent = isLoading ? 'Ingresando...' : 'Ingresar';
}

// Validación contra la API/VPS
async function iniciarSesion(usuario, password) {
  setLoginError('');

  if (!usuario || !password) {
    setLoginError('Ingresa tu usuario y contraseña');
    shakeCard();
    return;
  }

  setLoading(true);

  try {
    const respuesta = await fetch('https://app.loentrego.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        usuario: usuario,
        password: password
      })
    });

    const datos = await respuesta.json();

    if (respuesta.ok && datos.rol) {
      if (datos.token) {
        localStorage.setItem('auth_token', datos.token);
      }
      window.location.href = `Pages/Pages-${datos.rol.toLowerCase()}.html`;
    } else {
      setLoginError(datos.mensaje || 'Usuario o contraseña incorrectos');
      shakeCard();
      const passwordInput = document.getElementById('password');
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
    }
  } catch (error) {
    console.error('Error en la autenticación:', error);
    setLoginError('Error de conexión con el servidor');
    shakeCard();
  } finally {
    setLoading(false);
  }
}

// Vinculación de eventos al DOM
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const usuarioInput = document.getElementById('usuario');
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('toggle-password');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const usuario = usuarioInput ? usuarioInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      iniciarSesion(usuario, password);
    });
  }

  [usuarioInput, passwordInput].forEach((input) => {
    if (input) {
      input.addEventListener('input', () => setLoginError(''));
    }
  });

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      toggleBtn.textContent = isHidden ? 'Ocultar' : 'Ver';
      toggleBtn.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }
});

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
