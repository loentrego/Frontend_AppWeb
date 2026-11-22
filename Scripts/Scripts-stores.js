function openSheet(id){
  document.getElementById('overlay-' + id).classList.add('active');
}
function closeSheetBg(e, id){
  if(e.target.id === 'overlay-' + id){
    document.getElementById('overlay-' + id).classList.remove('active');
  }
}
function logout(){
  document.querySelectorAll('.sheet-overlay').forEach(o => o.classList.remove('active'));
  document.querySelectorAll('.app-shell').forEach(a => a.classList.remove('active'));
  currentPin = '';
  updatePinDots();
  const pinScreen = document.getElementById('pin-screen');
  pinScreen.style.display = 'flex';
  requestAnimationFrame(() => {
    pinScreen.style.opacity = '1';
    pinScreen.style.transform = 'scale(1)';
  });
}
function editField(field){
  // Placeholder: aquí se puede abrir un formulario o input editable para "field"
  console.log('Editar ' + field);
}

function openComercioOrder(destinatario, destino, ciudad, telefono, cobro, notas, estado){
  document.getElementById('co-destino').textContent = destino;
  document.getElementById('co-ciudad').textContent = ciudad;
  document.getElementById('co-destinatario').textContent = destinatario;
  document.getElementById('co-telefono').textContent = telefono;
  document.getElementById('co-cobro').textContent = cobro;
  document.getElementById('co-notas').textContent = notas;

  const pill = document.getElementById('co-estado');
  if(estado === 'si'){
    pill.textContent = 'Entregado';
    pill.className = 'status-pill si';
  } else {
    pill.textContent = 'No entregado';
    pill.className = 'status-pill no';
  }
  pill.style.cssText += 'display:inline-block; margin-bottom:18px; padding:8px 14px; font-size:12px;';

  document.getElementById('comercio-order-overlay').classList.add('active');
}
function closeComercioOrderBg(e){
  if(e.target.id === 'comercio-order-overlay'){
    document.getElementById('comercio-order-overlay').classList.remove('active');
  }
}