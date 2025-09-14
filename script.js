// navbar
    const menu = document.getElementById("menu");

    function toggleMenu() {
      menu.classList.toggle("show");
    }

  function toggleDropdown(e) {
     if (window.innerWidth <= 768) {
       e.preventDefault();
         let parent = e.target.parentElement;
         parent.classList.toggle("active");
       }
     }