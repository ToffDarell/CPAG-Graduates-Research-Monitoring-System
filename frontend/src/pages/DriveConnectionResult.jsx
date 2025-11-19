import { useEffect } from "react";

const messages = {
  success: {
    title: "Google Drive Connected",
    description: "You can close this window and return to the dashboard.",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
  },
  error: {
    title: "Connection Failed",
    description: "Please close this window and try connecting again.",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
  },
};

export default function DriveConnectionResult({ status = "success" }) {
  const variant = messages[status] || messages.success;

  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: status === "success" ? "DRIVE_CONNECT_SUCCESS" : "DRIVE_CONNECT_ERROR",
        },
        window.location.origin || "*"
      );
    }

    const timer = setTimeout(() => {
      window.close();
    }, 3500);

    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className={`${variant.bg} min-h-screen flex items-center justify-center`}>
      <div
        className={`max-w-lg w-full mx-4 p-6 rounded-xl border ${variant.border} ${variant.text} shadow-sm bg-white`}
      >
        <h1 className="text-2xl font-bold mb-2">{variant.title}</h1>
        <p className="text-sm mb-4">{variant.description}</p>
        <p className="text-xs text-gray-500">
          This window will close automatically. If it does not, you may close it manually.
        </p>
      </div>
    </div>
  );
}

