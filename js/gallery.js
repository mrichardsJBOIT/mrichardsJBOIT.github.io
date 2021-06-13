function activeGallery() {
	let thumbnails = document.querySelectorAll("#gallery-thumbs > div > img");
	let mainImage  = document.querySelector("#gallery-photo img");
	const currentClass = "current";
  thumbnails.forEach(function(thumbnail) {
    thumbnail.addEventListener("click", function(){
			//Set clicked image as the main image
			let newSrc = thumbnail.dataset.largeVersion;
			let newAlt = thumbnail.getAttribute("alt");
			mainImage.setAttribute("src", newSrc);
			mainImage.setAttribute("alt", newAlt);

			//change which image is current
			document.querySelector(`.${currentClass}`).classList.remove(currentClass);
			thumbnail.parentNode.classList.add(currentClass);
		});
  });
	console.log(thumbnails.innerText);
}
