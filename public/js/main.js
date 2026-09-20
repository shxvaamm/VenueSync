// VenueSync Vanilla JS Support
document.addEventListener('DOMContentLoaded', () => {
  // Auto-dismiss alerts when close button is clicked
  const alertCloses = document.querySelectorAll('.alert-close');
  alertCloses.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const alert = e.target.closest('.alert');
      if (alert) {
        alert.style.opacity = '0';
        alert.style.transition = 'opacity 200ms ease';
        setTimeout(() => alert.remove(), 200);
      }
    });
  });
});
