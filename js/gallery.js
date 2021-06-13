function activeGallery() {
	let thumbnails = document.querySelectorAll("#gallery-thumbs > div > img");
	let mainImage  = document.querySelector("#gallery-photo img");

  thumbnails.forEach(function(thumbnail) {
    thumbnail.addEventListener("click", function(){
			//Set clicked image as the main image
			let newSrc = thumbnail.dataset.largeVersion;
			mainImage.setAttribute("src", newSrc);
		});
  });
	console.log(thumbnails.innerText);
}
