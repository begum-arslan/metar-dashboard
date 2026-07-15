import html2canvas from 'html2canvas';

export const exportGraphAsPNG = async (chartRef, fileName = 'chart.png') => {
  if (!chartRef.current) return;
  
  try {
    const canvas = await html2canvas(chartRef.current, {
      backgroundColor: '#1e293b', // Matches dark mode background
      scale: 2, // Higher resolution
      logging: false,
      useCORS: true,
      allowTaint: true
    });
    
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = fileName;
    link.click();
  } catch (error) {
    console.error("Error exporting graph:", error);
    alert("Failed to export graph.");
  }
};
