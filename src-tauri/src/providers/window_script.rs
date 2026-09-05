pub(super) fn fifty_sounds_modal_download_initialization_script() -> &'static str {
    r##"(() => {
  const origin = "https://www.fiftysounds.com";
  const articlePath = "/royalty-free-music/";
  const directZip = new RegExp("^https://www\\.fiftysounds\\.com/music/[A-Za-z0-9][A-Za-z0-9._-]*\\.zip$");

  document.addEventListener("click", (event) => {
    if (window.location.origin !== origin || !window.location.pathname.startsWith(articlePath)) return;
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('[data-target="#myModal"], [data-bs-target="#myModal"], a[href="#myModal"]');
    if (!trigger) return;
    const modal = document.querySelector("#myModal");
    if (!(modal instanceof Element)) return;
    const anchor = [...modal.querySelectorAll("a[href]")].find((candidate) => {
      if (!(candidate instanceof HTMLAnchorElement)) return false;
      const href = candidate.getAttribute("href");
      if (!href) return false;
      const url = new URL(href, window.location.href);
      return directZip.test(url.href)
        && url.origin === origin
        && url.pathname.startsWith("/music/")
        && !url.search
        && !url.hash;
    });
    if (!(anchor instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    anchor.click();
  }, true);
})();"##
}
