export const getFecha = () =>
  new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export const getHora = () =>
  new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const getHoraC = () =>
  new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export const getDateISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export const getDate = () => new Date().toLocaleDateString('es-MX');
