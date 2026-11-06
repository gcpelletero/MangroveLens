import 'leaflet/dist/leaflet.css';

import * as ReactLeaflet from 'react-leaflet';

import { useEffect, useState } from 'react';
import { useMapEvents } from 'react-leaflet';

import Leaflet from 'leaflet';
import MapController from './MapController';
import styles from './Map.module.scss';

const { MapContainer } = ReactLeaflet;

function LocationMarker() {
  useMapEvents({
    click(e) {
      console.log(e.latlng);
    }
  });

  return null;
}

// const Map = ({ children, className, center, zoom, selectedRegion, ...rest }) => {

  const Map = ({
    children,
    className,
    center,
    zoom,
    selectedRegion,
    selectedProvince,
    selectedLayer,
    ...rest
  }) => {

  let mapClassName = styles.map;

  if (className) {
    mapClassName = `${mapClassName} ${className}`;
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0
      }}
    >
      <MapContainer
        zoomControl={false}
        className={mapClassName}
        center={center}
        zoom={zoom}
        {...rest}
        style={{
          width: '100%',
          height: '100%'
        }}
      >
        <ReactLeaflet.ZoomControl position="topright" />
        <LocationMarker />

        <MapController
          center={center}
          zoom={zoom}
          selectedRegion={selectedRegion}
        />

        {children(ReactLeaflet, Leaflet)}
      </MapContainer>
    </div>
  );
};

export default Map;