import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const REGION_COLORS = {
  'CAR':          '#7c3aed',
  'Region I':     '#1a56db',
  'Region II':    '#0891b2',
  'Region III':   '#0d9488',
  'NCR':          '#dc2626',
  'Region IV-A':  '#16a34a',
  'Region VII':   '#d97706',
  'Region XIII':  '#db2777',
};

function makePin(color, isHome) {
  const size = isHome ? 34 : 26;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};border:2.5px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.22);
      transform:rotate(-45deg)">
      <div style="width:40%;height:40%;background:#fff;border-radius:50%;
        margin:30% auto;transform:rotate(45deg)"></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

export default function BranchMap({ branches, userBranch, onBranchClick, flyToRef, autoFocusUser = false }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const markersGroupRef = useRef(null);

  useEffect(() => {
    if (instanceRef.current) return;
    const initialView = (userBranch && autoFocusUser) ? [userBranch.lat, userBranch.lng] : [12.5, 122.0];
    const initialZoom = (userBranch && autoFocusUser) ? 14 : 6;
    const map = L.map(mapRef.current, { zoomControl: false }).setView(initialView, initialZoom);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 18,
    }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);

    // Expose flyTo for sidebar clicks
    if (flyToRef) {
      flyToRef.current = (branch) => {
        map.flyTo([branch.lat, branch.lng], 14, { duration: 0.7 });
      };
    }

    instanceRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!instanceRef.current || !markersGroupRef.current) return;
    const group = markersGroupRef.current;
    group.clearLayers();

    branches.forEach(b => {
      const isHome = userBranch?.name === b.name;
      const color = REGION_COLORS[b.region] || '#6b7280';
      const marker = L.marker([b.lat, b.lng], { icon: makePin(color, isHome) }).addTo(group);

      // Popup content
      const days = (b.serviceTimes || []).map(s => `<span style="font-size:11px;background:#eff4ff;color:#1a56db;
        padding:2px 7px;border-radius:4px;font-weight:600;">${s.day}</span>`).join(' ');
      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif;min-width:180px;padding:2px 0;">
          ${isHome ? `<div style="font-size:10px;font-weight:700;color:#b45309;background:#fef3c7;
            padding:2px 8px;border-radius:20px;width:fit-content;margin-bottom:8px;">
            Your Branch</div>` : ''}
          <div style="font-weight:700;font-size:14px;color:#1a2a4a;margin-bottom:4px;">${b.name}</div>
          <div style="font-size:12px;color:#6b7a99;margin-bottom:8px;">${b.province} &middot; ${b.region}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;">${days}</div>
          <button onclick="window.__branchClick('${b.name.replace(/'/g, "\\'")}')" style="width:100%;padding:7px;
            background:#1a56db;color:#fff;border:none;border-radius:6px;
            font-size:12px;font-weight:600;cursor:pointer;">View Details</button>
        </div>
      `, { maxWidth: 220 });
    });
  }, [branches, userBranch]);

  // Wire up the popup button to React's onBranchClick
  useEffect(() => {
    window.__branchClick = (branchName) => {
      const branch = branches.find(b => b.name === branchName);
      if (branch) onBranchClick(branch);
    };
    return () => { delete window.__branchClick; };
  }, [branches, onBranchClick]);

  useEffect(() => {
    if (instanceRef.current && userBranch && autoFocusUser) {
      instanceRef.current.setView([userBranch.lat, userBranch.lng], 14);
    }
  }, [userBranch, autoFocusUser]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}
