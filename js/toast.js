/**
 * toast.js — Sistema centralizado de notificações.
 * Importar esta função em qualquer módulo que precise notificar o usuário.
 */

let _timer = null;

/**
 * @param {string} msg   — texto da notificação
 * @param {'ok'|'warn'|'err'|'local'} type
 */
export function toast(msg, type = 'ok') {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  // Força reflow para reiniciar a animação mesmo com o mesmo texto
  el.className = '';
  void el.offsetWidth;
  el.className = `toast-${type} toast-show`;
  clearTimeout(_timer);
  _timer = setTimeout(() => {
    el.classList.remove('toast-show');
  }, 3000);
}
