// envUtils.js
// The old `nitjtt` branch pointed at https://nitjtt.onrender.com, which is no
// longer a live deployment. It was not merely dead — it was actively harmful:
// every AMS page builds its API base from this one function, so any URL
// carrying "nitjtt" sent attendance runs to the Render box. That box has its
// own empty disk, and the embedding .pkl is read from the serving process's
// local ml-data/embeddings (see server embeddingPathResolver.js), so live
// attendance failed there with "embeddingFile not found on disk".
function getEnvironment() {
  const currentURL = window.location.href;
  const development = 'http://localhost:8010';
  const nitjServer = 'http://localhost:8010';
  if (currentURL.includes('localhost') || currentURL.includes('127.0.0.1')) {
    return development;
  } else {
    return nitjServer;
  }
}

export default getEnvironment;
