// app/api/admin/analytics/heatmap/route.ts

import { createClient } from "@/lib/supabase/server";

const provinceCoordinates: Record<
  string,
  { lat: [number, number]; lng: [number, number] }
> = {
  "PH-ABR": { lat: [17.53, 17.67], lng: [120.73, 120.97] },
  "PH-AGN": { lat: [8.93, 9.27], lng: [125.4, 125.73] },
  "PH-AGS": { lat: [8.13, 8.8], lng: [125.33, 126.07] },
  "PH-AKL": { lat: [11.5, 11.9], lng: [122.0, 122.6] },
  "PH-ALB": { lat: [13.07, 13.47], lng: [123.6, 124.13] },
  "PH-ANT": { lat: [10.6, 11.6], lng: [121.87, 122.2] },
  "PH-APA": { lat: [18.27, 18.53], lng: [120.8, 121.47] },
  "PH-AUR": { lat: [15.73, 16.07], lng: [121.47, 121.73] },
  "PH-BAS": { lat: [6.33, 6.73], lng: [121.97, 122.27] },
  "PH-BTN": { lat: [14.53, 14.87], lng: [120.4, 120.73] },
  "PH-BTG": { lat: [13.73, 14.2], lng: [120.87, 121.33] },
  "PH-BEN": { lat: [16.33, 16.67], lng: [120.53, 120.87] },
  "PH-BIL": { lat: [11.47, 11.67], lng: [124.47, 124.67] },
  "PH-BOH": { lat: [9.6, 10.13], lng: [123.87, 124.6] },
  "PH-BUK": { lat: [7.87, 8.67], lng: [124.27, 125.27] },
  "PH-BUL": { lat: [14.73, 15.2], lng: [120.73, 121.13] },
  "PH-CAG": { lat: [17.87, 18.6], lng: [121.13, 122.0] },
  "PH-CAN": { lat: [14.07, 14.27], lng: [122.53, 122.87] },
  "PH-CAS": { lat: [13.07, 13.87], lng: [123.07, 123.6] },
  "PH-CAM": { lat: [9.07, 9.27], lng: [124.67, 124.87] },
  "PH-CAP": { lat: [11.33, 11.67], lng: [122.47, 122.87] },
  "PH-CAT": { lat: [13.47, 14.0], lng: [124.2, 124.47] },
  "PH-CAV": { lat: [14.2, 14.47], lng: [120.87, 121.2] },
  "PH-CEB": { lat: [9.53, 11.27], lng: [123.27, 124.27] },
  "PH-COM": { lat: [7.53, 8.0], lng: [125.93, 126.4] },
  "PH-DAV": { lat: [7.33, 8.0], lng: [125.33, 126.0] },
  "PH-DAS": { lat: [6.2, 7.33], lng: [124.73, 125.93] },
  "PH-DAO": { lat: [6.47, 7.33], lng: [126.0, 126.6] },
  "PH-DIN": { lat: [10.07, 10.2], lng: [125.53, 125.73] },
  "PH-EAS": { lat: [11.0, 12.47], lng: [125.0, 125.73] },
  "PH-GUI": { lat: [10.53, 10.73], lng: [122.53, 122.73] },
  "PH-IFU": { lat: [16.73, 17.13], lng: [120.87, 121.27] },
  "PH-ILN": { lat: [17.93, 18.53], lng: [120.33, 120.87] },
  "PH-ILS": { lat: [16.87, 17.93], lng: [120.33, 120.87] },
  "PH-ILI": { lat: [10.4, 11.47], lng: [122.33, 123.13] },
  "PH-ISA": { lat: [16.93, 17.93], lng: [121.27, 122.4] },
  "PH-KAL": { lat: [17.33, 17.73], lng: [120.87, 121.47] },
  "PH-LUN": { lat: [16.47, 16.87], lng: [120.27, 120.67] },
  "PH-LAG": { lat: [14.07, 14.47], lng: [121.07, 121.6] },
  "PH-LAN": { lat: [7.87, 8.4], lng: [123.73, 124.27] },
  "PH-LAS": { lat: [7.27, 8.27], lng: [124.07, 124.47] },
  "PH-LEY": { lat: [10.73, 11.47], lng: [124.47, 125.13] },
  "PH-MG": { lat: [6.07, 7.47], lng: [124.07, 124.87] },
  "PH-MAD": { lat: [13.27, 13.6], lng: [121.87, 122.27] },
  "PH-MAS": { lat: [11.87, 12.67], lng: [123.6, 124.47] },
  "PH-MNL": { lat: [14.47, 14.8], lng: [120.93, 121.13] },
  "PH-MSC": { lat: [8.2, 8.8], lng: [123.47, 124.13] },
  "PH-MSR": { lat: [8.33, 9.33], lng: [124.13, 125.13] },
  "PH-MOU": { lat: [16.93, 17.33], lng: [120.73, 121.13] },
  "PH-NEC": { lat: [9.87, 11.0], lng: [122.33, 123.47] },
  "PH-NER": { lat: [9.13, 10.73], lng: [122.87, 123.47] },
  "PH-NCO": { lat: [6.87, 7.87], lng: [124.27, 125.27] },
  "PH-NSA": { lat: [12.33, 12.67], lng: [124.73, 125.27] },
  "PH-NUE": { lat: [15.33, 15.87], lng: [120.87, 121.33] },
  "PH-NUV": { lat: [16.07, 16.53], lng: [121.07, 121.47] },
  "PH-MDC": { lat: [12.87, 13.6], lng: [120.93, 121.47] },
  "PH-MDR": { lat: [12.27, 13.47], lng: [121.07, 121.93] },
  "PH-PLW": { lat: [8.33, 11.2], lng: [117.07, 119.93] },
  "PH-PAM": { lat: [14.93, 15.33], lng: [120.47, 120.93] },
  "PH-PAN": { lat: [15.73, 16.47], lng: [119.87, 120.6] },
  "PH-QUE": { lat: [13.87, 14.87], lng: [121.33, 122.27] },
  "PH-QUI": { lat: [16.27, 16.53], lng: [121.47, 121.73] },
  "PH-RIZ": { lat: [14.2, 14.73], lng: [121.13, 121.33] },
  "PH-ROM": { lat: [12.2, 12.87], lng: [122.07, 122.87] },
  "PH-WSA": { lat: [11.4, 12.33], lng: [124.87, 125.73] },
  "PH-SAR": { lat: [5.4, 6.07], lng: [124.73, 125.47] },
  "PH-SIG": { lat: [9.13, 9.27], lng: [123.47, 123.67] },
  "PH-SOR": { lat: [12.73, 13.13], lng: [123.87, 124.6] },
  "PH-SCO": { lat: [6.07, 6.87], lng: [124.47, 125.2] },
  "PH-SLE": { lat: [9.87, 10.73], lng: [124.73, 125.47] },
  "PH-SUK": { lat: [6.07, 6.93], lng: [124.07, 124.73] },
  "PH-SLU": { lat: [4.93, 6.13], lng: [119.27, 121.07] },
  "PH-SUN": { lat: [9.47, 10.07], lng: [125.47, 126.33] },
  "PH-SUR": { lat: [8.47, 9.47], lng: [125.93, 126.6] },
  "PH-TAR": { lat: [15.2, 15.73], lng: [120.27, 120.73] },
  "PH-TAW": { lat: [4.93, 5.27], lng: [119.73, 120.13] },
  "PH-ZMB": { lat: [14.87, 15.73], lng: [119.87, 120.47] },
  "PH-ZAN": { lat: [8.2, 9.87], lng: [122.33, 123.47] },
  "PH-ZAS": { lat: [6.87, 8.2], lng: [122.07, 123.33] },
  "PH-ZSI": { lat: [7.33, 8.0], lng: [122.07, 122.87] },
};

function getProvinceFromCoordinates(lat: number, lng: number): string | null {
  for (const [provinceCode, bounds] of Object.entries(provinceCoordinates)) {
    if (
      lat >= bounds.lat[0] &&
      lat <= bounds.lat[1] &&
      lng >= bounds.lng[0] &&
      lng <= bounds.lng[1]
    ) {
      return provinceCode;
    }
  }
  return null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("delivery_location")
      .not("delivery_location", "is", null);

    if (error) {
      throw error;
    }

    console.log("Fetched orders:", orders);

    const provinceCount: Record<string, number> = {};

    orders.forEach((order) => {
      let lat: number | null = null;
      let lng: number | null = null;

      const coords = order.delivery_location?.coordinates;

      if (Array.isArray(coords?.coordinates) && coords.coordinates.length === 2) {
        // GeoJSON format: [lng, lat]
        [lng, lat] = coords.coordinates;
      } else if (
        typeof coords?.lat === "number" &&
        typeof coords?.lng === "number"
      ) {
        // Simple {lat, lng} object
        lat = coords.lat;
        lng = coords.lng;
      }

      if (lat !== null && lng !== null) {
        const province = getProvinceFromCoordinates(lat, lng);

        console.log(
          `Order coordinates: (${lat}, ${lng}) mapped to province: ${province}`
        );

        if (province) {
          provinceCount[province] = (provinceCount[province] || 0) + 1;
        }
      } else {
        console.log("Order missing valid coordinates:", order);
      }
    });


    const maxCount = Math.max(...Object.values(provinceCount));
    const normalizedData: Record<string, number> = {};

    Object.entries(provinceCount).forEach(([province, count]) => {
      normalizedData[province] = Math.round((count / maxCount) * 100);
    });

    return Response.json(normalizedData);
  } catch (error) {
    console.error("Error fetching heatmap data:", error);
    return Response.json(
      { error: "Failed to fetch heatmap data" },
      { status: 500 }
    );
  }
}
