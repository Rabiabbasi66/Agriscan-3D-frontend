// src/services/api.js
const API_URL = "https://predict-6a88237196138d833c705aec-dproatj77a-ez.a.run.app";
const API_KEY = "ul_01786bfbd9c0e301e77a5693dcc13a5671d98597";

export const predictDisease = async (imageFile) => {
  console.log("📤 API_URL:", API_URL);

  const formData = new FormData();
  formData.append('file', imageFile);

  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Prediction Result:", data);
    return data;
  } catch (error) {
    console.error("❌ Prediction Error:", error);
    return null;
  }
};