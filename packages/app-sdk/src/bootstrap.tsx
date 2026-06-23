"use client";

export function StellarToolsAppBootstrap({ baseUrl }: { baseUrl: string }) {
  return (
    <>
      <base href={baseUrl}></base>
      <script
        dangerouslySetInnerHTML={{
          __html: `
          (function() {
            const originalPushState = history.pushState;
            history.pushState = function(state, unused, url) {
              const u = new URL(url, window.location.href);
              // Notify the host that the path changed
              window.parent.postMessage({ 
                type: 'stellar:set-path', 
                payload: { path: u.pathname + u.search } 
              }, "*");
              return originalPushState.apply(this, arguments);
            };

            // Fetch Proxy: Automatically attach the st_token to internal requests
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
              const stToken = new URLSearchParams(window.location.search).get('st_token');
              if (stToken && args[1]) {
                args[1].headers = {
                  ...args[1].headers,
                  'Authorization': 'Bearer ' + stToken
                };
              }
              return originalFetch(...args);
            };
          })();
        `,
        }}
      />
    </>
  );
}
