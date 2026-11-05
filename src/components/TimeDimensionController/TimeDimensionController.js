import { useEffect, useState } from 'react';

const TimeDimensionController = ({ 
  timeSeriesMaps, 
  isVisible, 
  onToggle, 
  onDateChange,
  selectedDate,
  isPlaying: externalIsPlaying,
  onPlayStateChange 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // milliseconds
  const [intervalId, setIntervalId] = useState(null);

  // Sort maps by date
  const sortedMaps = timeSeriesMaps ? 
    [...timeSeriesMaps].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];

  useEffect(() => {
    if (sortedMaps.length > 0 && selectedDate) {
      const index = sortedMaps.findIndex(map => map.date === selectedDate);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [selectedDate, sortedMaps]);

  useEffect(() => {
    if (externalIsPlaying !== undefined) {
      setIsPlaying(externalIsPlaying);
    }
  }, [externalIsPlaying]);

  useEffect(() => {
    if (isPlaying && sortedMaps.length > 0) {
      const id = setInterval(() => {
        setCurrentIndex(prevIndex => {
          const nextIndex = prevIndex >= sortedMaps.length - 1 ? 0 : prevIndex + 1;
          if (sortedMaps[nextIndex] && onDateChange) {
            onDateChange(sortedMaps[nextIndex].date);
          }
          return nextIndex;
        });
      }, playbackSpeed);
      
      setIntervalId(id);
      return () => clearInterval(id);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }
  }, [isPlaying, playbackSpeed, sortedMaps, onDateChange]);

  const handlePlay = () => {
    const newPlayState = !isPlaying;
    setIsPlaying(newPlayState);
    if (onPlayStateChange) {
      onPlayStateChange(newPlayState);
    }
  };

  const handleSliderChange = (e) => {
    const index = parseInt(e.target.value);
    setCurrentIndex(index);
    if (sortedMaps[index] && onDateChange) {
      onDateChange(sortedMaps[index].date);
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isVisible || !sortedMaps || sortedMaps.length === 0) {
    return null;
  }

  const currentMap = sortedMaps[currentIndex];
  const progress = sortedMaps.length > 1 ? (currentIndex / (sortedMaps.length - 1)) * 100 : 0;

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1001,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid #dee2e6',
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      minWidth: '400px',
      maxWidth: '600px'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '12px' 
      }}>
        <div>
          <h4 style={{
            margin: '0 0 4px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: '#343a40'
          }}>
            NDVI Time Series
          </h4>
          <p style={{
            margin: 0,
            fontSize: '11px',
            color: '#6c757d'
          }}>
            {currentMap ? formatDate(currentMap.date) : 'No date selected'}
            {sortedMaps.length > 0 && ` • ${currentIndex + 1} of ${sortedMaps.length}`}
          </p>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'transparent',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#6c757d'
          }}
        >
          ×
        </button>
      </div>

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px',
        marginBottom: '12px'
      }}>
        {/* Play/Pause Button */}
        <button
          onClick={handlePlay}
          style={{
            background: isPlaying ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s'
          }}
        >
          <span style={{ fontSize: '16px' }}>
            {isPlaying ? '⏸️' : '▶️'}
          </span>
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        {/* Previous/Next Controls */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => {
              const newIndex = Math.max(0, currentIndex - 1);
              setCurrentIndex(newIndex);
              if (sortedMaps[newIndex] && onDateChange) {
                onDateChange(sortedMaps[newIndex].date);
              }
            }}
            disabled={currentIndex === 0}
            style={{
              background: currentIndex === 0 ? '#e9ecef' : '#6c757d',
              color: currentIndex === 0 ? '#adb5bd' : 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 8px',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            ⏮️
          </button>
          <button
            onClick={() => {
              const newIndex = Math.min(sortedMaps.length - 1, currentIndex + 1);
              setCurrentIndex(newIndex);
              if (sortedMaps[newIndex] && onDateChange) {
                onDateChange(sortedMaps[newIndex].date);
              }
            }}
            disabled={currentIndex === sortedMaps.length - 1}
            style={{
              background: currentIndex === sortedMaps.length - 1 ? '#e9ecef' : '#6c757d',
              color: currentIndex === sortedMaps.length - 1 ? '#adb5bd' : 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 8px',
              cursor: currentIndex === sortedMaps.length - 1 ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            ⏭️
          </button>
        </div>

        {/* Speed Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#6c757d' }}>Speed:</span>
          {[2000, 1000, 500, 250].map(speed => (
            <button
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              style={{
                background: playbackSpeed === speed ? '#007bff' : 'transparent',
                color: playbackSpeed === speed ? 'white' : '#6c757d',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '10px',
                transition: 'all 0.2s'
              }}
            >
              {speed === 2000 ? '0.5x' : speed === 1000 ? '1x' : speed === 500 ? '2x' : '4x'}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Slider */}
      <div style={{ position: 'relative', marginBottom: '8px' }}>
        <input
          type="range"
          min={0}
          max={sortedMaps.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          style={{
            width: '100%',
            height: '8px',
            borderRadius: '4px',
            background: `linear-gradient(to right, #007bff 0%, #007bff ${progress}%, #e9ecef ${progress}%, #e9ecef 100%)`,
            outline: 'none',
            cursor: 'pointer'
          }}
        />
        
        {/* Timeline Labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
          fontSize: '9px',
          color: '#6c757d'
        }}>
          <span>
            {sortedMaps.length > 0 ? formatDate(sortedMaps[0].date) : ''}
          </span>
          <span>
            {sortedMaps.length > 0 ? formatDate(sortedMaps[sortedMaps.length - 1].date) : ''}
          </span>
        </div>
      </div>

      {/* Progress Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '10px',
        color: '#6c757d',
        gap: '12px'
      }}>
        <span>
          📊 {sortedMaps.length} time steps
        </span>
        <span>
          🔄 16-day composites
        </span>
        {isPlaying && (
          <span style={{ color: '#28a745' }}>
            ▶️ Playing at {playbackSpeed === 2000 ? '0.5x' : playbackSpeed === 1000 ? '1x' : playbackSpeed === 500 ? '2x' : '4x'} speed
          </span>
        )}
      </div>
    </div>
  );
};

export default TimeDimensionController;