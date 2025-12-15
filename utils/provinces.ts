export const provinces = [
  "PH-SUR","PH-TAR","PH-TAW","PH-ZMB","PH-ZAN","PH-ZSI","PH-ABR","PH-AGN",
  "PH-AGS","PH-AKL","PH-ALB","PH-ANT","PH-APA","PH-AUR","PH-BAN","PH-BTN",
  "PH-BTG","PH-BEN","PH-BIL","PH-BOH","PH-BUK","PH-BUL","PH-CAG","PH-CAN",
  "PH-CAS","PH-CAM","PH-CAP","PH-CAT","PH-CAV","PH-CEB","PH-COM","PH-DAV",
  "PH-DAS","PH-DAO","PH-DIN","PH-EAS","PH-GUI","PH-IFU","PH-ILN","PH-ILS",
  "PH-ILI","PH-ISA","PH-KAL","PH-LUN","PH-LAG","PH-LAN","PH-LAS","PH-LEY",
  "PH-MG","PH-MAD","PH-MAS","PH-MNL","PH-MSC","PH-MSR","PH-MOU","PH-NEC",
  "PH-NER","PH-NCO","PH-NSA","PH-NUE","PH-NUV","PH-MDC","PH-MDR","PH-PLW",
  "PH-PAM","PH-PAN","PH-QUE","PH-QUI","PH-RIZ","PH-ROM","PH-WSA","PH-SAR",
  "PH-SIG","PH-SOR","PH-SCO","PH-SLE","PH-SUK","PH-SLU","PH-SUN","PH-BAS",
  "PH-ZAS",
];

// Updated helper function that works with the global method
export function colorProvince(id: string, color: string) {
  // First try the global method if available
  if ((window as any).colorPhilippineProvince) {
    (window as any).colorPhilippineProvince(id, color);
    return;
  }
  
  // Fallback to direct DOM access
  const el = document.getElementById(id);
  if (el) {
    el.setAttribute("fill", color);
  }
}

// Alternative: Accept a container element to search within
export function colorProvinceInContainer(container: Element, id: string, color: string) {
  const el = container.querySelector(`#${id}`);
  if (el) {
    el.setAttribute("fill", color);
  }
}