"use client";

import * as React from "react";

import { useCookieState } from "@/hooks/use-cookie-state";
import { AppModal } from "@stellartools/shared-ui";

export const MainnetReadinessModal = React.memo(() => {
  const [hasAcknowledgedNotice, setHasAcknowledgedNotice] = useCookieState<boolean>(
    "mainnet-readiness-notice-acknowledged-v1",
    false
  );

  const hasOpenedModalRef = React.useRef(false);
  const acknowledgedThisSessionRef = React.useRef(false);
  const [shouldShowModal, setShouldShowModal] = React.useState(false);

  React.useEffect(() => {
    if (hasAcknowledgedNotice) return;

    // Wait one macrotask so AppModalProvider has time to register global state.
    const timeoutId = window.setTimeout(() => {
      setShouldShowModal(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasAcknowledgedNotice]);

  const handleOpenModal = React.useCallback(() => {
    if (hasAcknowledgedNotice || hasOpenedModalRef.current || !shouldShowModal) return;

    hasOpenedModalRef.current = true;

    AppModal.open({
      title: "Mainnet Readiness Notice",
      description: "Stellar Tools is currently in active development.",
      content: (
        <div className="text-muted-foreground space-y-3 text-sm sm:text-base">
          <p>This app is not production ready yet and should not be used for any mainnet transactions at this time.</p>
          <p>
            By continuing, you acknowledge that features and behavior may change while we continue to stabilize the
            platform.
          </p>
        </div>
      ),
      size: "small",
      showCloseButton: false,
      onClose: () => {
        hasOpenedModalRef.current = false;

        if (!acknowledgedThisSessionRef.current) {
          setShouldShowModal(true);
        }
      },
      primaryButton: {
        children: "Agree",
        onClick: () => {
          acknowledgedThisSessionRef.current = true;
          setHasAcknowledgedNotice(true);
          setShouldShowModal(false);
        },
      },
    });
  }, [hasAcknowledgedNotice, setHasAcknowledgedNotice, shouldShowModal]);

  React.useEffect(() => {
    handleOpenModal();
  }, [handleOpenModal]);

  return null;
});
