import Swal from "sweetalert2";

// App color palette
const PRIMARY_COLOR = "#7C1D23";
const SECONDARY_COLOR = "#5c151a";
const GRAY_COLOR = "#6B7280";

/**
 * Show a success alert
 */
export const showSuccess = (title, text = "") => {
  return Swal.fire({
    title,
    text,
    icon: "success",
    confirmButtonColor: PRIMARY_COLOR,
    confirmButtonText: "OK",
  });
};

/**
 * Show an error alert
 */
export const showError = (title, text = "") => {
  return Swal.fire({
    title,
    text,
    icon: "error",
    confirmButtonColor: PRIMARY_COLOR,
    confirmButtonText: "OK",
  });
};

/**
 * Show a warning alert
 */
export const showWarning = (title, text = "") => {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    confirmButtonColor: PRIMARY_COLOR,
    confirmButtonText: "OK",
  });
};

/**
 * Show an info alert
 */
export const showInfo = (title, text = "") => {
  return Swal.fire({
    title,
    text,
    icon: "info",
    confirmButtonColor: PRIMARY_COLOR,
    confirmButtonText: "OK",
  });
};

/**
 * Show a confirmation dialog
 */
export const showConfirm = (title, text = "", confirmText = "Yes", cancelText = "Cancel", showCloseButton = false) => {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    showCloseButton: showCloseButton,
    confirmButtonColor: PRIMARY_COLOR,
    cancelButtonColor: GRAY_COLOR,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
  });
};

/**
 * Show a confirmation dialog for destructive actions
 */
export const showDangerConfirm = (title, text = "", confirmText = "Yes, proceed", cancelText = "Cancel") => {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#DC2626", // Red for dangerous actions
    cancelButtonColor: GRAY_COLOR,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
  });
};

export default {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showConfirm,
  showDangerConfirm,
};



