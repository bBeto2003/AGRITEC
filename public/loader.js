document.addEventListener('DOMContentLoaded', function() {
    // Obtener todos los enlaces de navegación
    const navLinks = document.querySelectorAll('a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Solo si el enlace lleva a otra página HTML
            if (this.href.endsWith('.html')) {
                e.preventDefault();
                const loader = document.getElementById('loader-wrapper');
                
                // Mostrar el loader
                loader.style.display = 'flex';
                
                // Esperar 3 segundos antes de navegar a la nueva página
                setTimeout(() => {
                    window.location.href = this.href;
                }, 700);
            }
        });
    });
});
