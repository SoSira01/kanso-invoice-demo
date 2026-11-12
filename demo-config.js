// Paste your Gumroad or Lemon Squeezy product URL below before uploading demo-site/
window.KANSO_BUY_URL = "https://gumroad.com/";

document.addEventListener("DOMContentLoaded", function () {
  document.body.setAttribute("data-demo", "true");
  var buyLink = document.getElementById("demo-buy-link");
  if (buyLink && window.KANSO_BUY_URL) {
    buyLink.href = window.KANSO_BUY_URL;
    buyLink.target = "_blank";
    buyLink.rel = "noopener noreferrer";
  }
});
