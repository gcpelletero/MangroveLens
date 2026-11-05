import React, { useEffect, useRef } from 'react';

import Chart from 'chart.js/auto';

/**
 * NDVIGraphPanel Component
 * Displays a multi-year NDVI pattern based on calendar days (1-365).
 */
const NDVIGraphPanel = ({ 
  calendarDayAverages, 
  isVisible, 
  onToggle, 
  selectedDate,
  metadata 
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // Helper: Get normalized calendar day (handles leap years for alignment)
  const getNormalizedDay = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const day = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    const isLeapYear = (date.getFullYear() % 4 === 0 && date.getFullYear() % 100 !== 0) || (date.getFullYear() % 400 === 0);
    return (isLeapYear && day > 59) ? day - 1 : day;
  };

  useEffect(() => {
    // 1. Cleanup: Destroy existing chart if hidden or data changes
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (!isVisible || !chartRef.current || !calendarDayAverages?.length) return;

    const ctx = chartRef.current.getContext('2d');
    const currentDay = getNormalizedDay(selectedDate);
    
    // 2. Prepare Data
    const sortedData = [...calendarDayAverages].sort((a, b) => a.calendarDay - b.calendarDay);
    
    // 3. Custom Plugin for the "Current Day" vertical line
    const referenceLinePlugin = {
      id: 'referenceLines',
      beforeDraw: (chart) => {
        if (currentDay && currentDay >= 1 && currentDay <= 365) {
          const { ctx, scales: { x, y } } = chart;
          const xPos = x.getPixelForValue(currentDay);
          ctx.save();
          ctx.strokeStyle = '#ff6b35'; // Orange line
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(xPos, y.top);
          ctx.lineTo(xPos, y.bottom);
          ctx.stroke();
          ctx.restore();
        }
      }
    };

    // 4. Initialize New Chart
    try {
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: sortedData.map(d => d.calendarDay),
          datasets: [
            {
              label: 'Multi-year Average',
              data: sortedData.map(d => d.ndvi_mean),
              borderColor: '#22c55e', // Green
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              fill: true
            },
            {
              label: 'Multi-year Median',
              data: sortedData.map(d => d.ndvi_median),
              borderColor: '#3b82f6', // Blue
              borderWidth: 1.5,
              borderDash: [4, 4],
              pointRadius: 0,
              tension: 0.3,
              fill: false
            }
          ]
        },
        plugins: [referenceLinePlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false, // Prevents glitches on rapid updates
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false }, // Using custom footer legend
            tooltip: {
              callbacks: {
                title: (context) => {
                  const day = context[0].label;
                  const date = new Date(2023, 0, day); // Dummy year for labels
                  return `Day ${day} (${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              min: 1,
              max: 365,
              ticks: {
                stepSize: 30,
                callback: (val) => {
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const d = new Date(2023, 0, val);
                  return val % 30 === 0 ? months[d.getMonth()] : '';
                }
              },
              grid: { display: false }
            },
            y: {
              min: 0,
              max: 1.0,
              title: { display: true, text: 'NDVI Value' },
              ticks: { stepSize: 0.2 }
            }
          }
        }
      });
    } catch (err) {
      console.error("Chart creation error:", err);
    }

    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [calendarDayAverages, isVisible, selectedDate]);

  if (!isVisible) {
    return (
      <button onClick={onToggle} style={styles.showBtn}>
        <span>📊</span> View NDVI Graph
      </button>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h4 style={styles.title}>🌱 NDVI Calendar Pattern</h4>
          <p style={styles.subtitle}>Average vegetation health by day of year</p>
        </div>
        <button onClick={onToggle} style={styles.closeBtn}>×</button>
      </div>

      <div style={styles.chartWrapper}>
        <canvas ref={chartRef} />
      </div>

      <div style={styles.footer}>
        <div style={styles.legendItem}><div style={{...styles.dot, background: '#22c55e'}}/> Mean</div>
        <div style={styles.legendItem}><div style={{...styles.dot, background: '#3b82f6', borderRadius: '0'}}/> Median</div>
        {selectedDate && (
          <div style={styles.legendItem}><div style={{...styles.dot, background: '#ff6b35', height: '10px'}}/> Selected</div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'absolute', top: '20px', right: '20px', width: '420px', height: '360px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)',
    borderRadius: '12px', padding: '16px', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    border: '1px solid #ddd', display: 'flex', flexDirection: 'column'
  },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  title: { margin: 0, fontSize: '16px', color: '#333' },
  subtitle: { margin: 0, fontSize: '11px', color: '#777' },
  closeBtn: { border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' },
  chartWrapper: { flex: 1, position: 'relative' },
  footer: { display: 'flex', gap: '15px', marginTop: '10px', fontSize: '11px', color: '#555', borderTop: '1px solid #eee', paddingTop: '10px' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '5px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%' },
  showBtn: {
    position: 'absolute', top: '20px', right: '20px', zIndex: 1001,
    padding: '10px 15px', borderRadius: '8px', border: '1px solid #ddd',
    backgroundColor: '#fff', cursor: 'pointer', fontWeight: '500', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  }
};

export default NDVIGraphPanel;