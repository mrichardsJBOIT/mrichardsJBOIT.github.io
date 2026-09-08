/* Gr8ful Dev — site JS */
(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.getElementById("nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Gallery lightbox
  var grid = document.getElementById("gallery-grid");
  var box = document.getElementById("lightbox");
  if (grid && box) {
    var boxImg = box.querySelector(".lightbox-img");
    var boxCaption = box.querySelector(".lightbox-caption");
    function openBox(fig) {
      var img = fig.querySelector("img");
      var caption = fig.querySelector("figcaption");
      boxImg.src = fig.dataset.large || img.src;
      boxImg.alt = img.alt;
      boxCaption.textContent = caption ? caption.textContent : "";
      box.hidden = false;
      document.body.style.overflow = "hidden";
    }
    function closeBox() {
      box.hidden = true;
      boxImg.src = "";
      document.body.style.overflow = "";
    }
    grid.addEventListener("click", function (e) {
      var fig = e.target.closest("figure");
      if (fig) openBox(fig);
    });
    box.querySelector(".lightbox-close").addEventListener("click", closeBox);
    box.addEventListener("click", function (e) {
      if (e.target === box) closeBox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !box.hidden) closeBox();
    });
  }
})();