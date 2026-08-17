function getEnvironment() {
  const currentURL = window.location.href;
  const development = 'http://localhost:8010';
  const production = 'https://nitjtt.onrender.com';
  const nitjServer = 'https://xceed.nitj.ac.in';
  const androidEmulator = 'http://10.0.2.2:8010';

  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    return nitjServer;
  } else if (currentURL.includes('localhost') || currentURL.includes('127.0.0.1')) {
    return development;
  }else {
    // Default to a specific environment or handle other cases
    return nitjServer;
  }
}

export default getEnvironment;