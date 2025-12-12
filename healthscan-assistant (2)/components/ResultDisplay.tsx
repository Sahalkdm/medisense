import React, { useState, useEffect, useRef } from 'react';
import { HealthAssessment, MapSearchResult, Place } from '../types';
import { 
  AlertTriangle, CheckCircle, Info, ShieldAlert, Share2, 
  Activity, Heart, Moon, Utensils, FileText, Check, X as XIcon,
  Microscope, Brain, HelpCircle, MapPin, Navigation, Star
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { findNearbyPlaces } from '../services/geminiService';

// Add type definition for Leaflet global
declare global {
  interface Window {
    L: any;
  }
}

interface ResultDisplayProps {
  data: HealthAssessment;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'simple' | 'expert'>('simple');
  const [mapSearch, setMapSearch] = useState<{
    isLoading: boolean;
    result: MapSearchResult | null;
    error: string | null;
  }>({ isLoading: false, result: null, error: null });
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Initialize Map when results change
  useEffect(() => {
    if (mapSearch.result && mapContainerRef.current && window.L && !mapSearch.isLoading) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const center = mapSearch.result.searchCenter || { lat: 0, lng: 0 };
      const map = window.L.map(mapContainerRef.current).setView([center.lat, center.lng], 13);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      mapInstanceRef.current = map;

      // User Location Marker
      const userIcon = window.L.divIcon({
        html: `<div class="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-md animate-pulse">
                <div class="w-2 h-2 bg-white rounded-full"></div>
               </div>`,
        className: 'bg-transparent',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      window.L.marker([center.lat, center.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup("<b>You are here</b>");

      // Place Markers
      const placeIconHtml = `
        <div class="relative w-10 h-10 -ml-5 -mt-10">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 text-red-600 drop-shadow-md">
             <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
           </svg>
        </div>
      `;

      const placeIcon = window.L.divIcon({
        html: placeIconHtml,
        className: 'bg-transparent',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
      });

      const bounds = window.L.latLngBounds([[center.lat, center.lng]]);

      mapSearch.result.places.forEach((place) => {
        if (place.latitude && place.longitude) {
           const marker = window.L.marker([place.latitude, place.longitude], { icon: placeIcon })
             .addTo(map)
             .bindPopup(`
               <div class="p-1 min-w-[200px]">
                 <h3 class="font-bold text-base text-slate-800 mb-1">${place.name}</h3>
                 <div class="flex items-center text-yellow-500 mb-1">
                   <span class="text-xs font-bold mr-1">${place.rating || 'N/A'}</span>
                   <span>★</span>
                 </div>
                 <p class="text-xs text-slate-600 mb-2">${place.address}</p>
                 <div class="text-xs bg-slate-100 p-2 rounded border border-slate-200 text-slate-700 italic">
                   "${place.reason}"
                 </div>
                 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}" target="_blank" class="block mt-2 text-center text-xs bg-blue-600 !text-white py-1.5 rounded hover:bg-blue-700 font-medium no-underline">
                   Get Directions
                 </a>
               </div>
             `);
           bounds.extend([place.latitude, place.longitude]);
        }
      });

      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [mapSearch.result, mapSearch.isLoading]);

  const getRiskStyles = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-50 border-green-200 text-green-900';
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'urgent': return 'bg-red-50 border-red-200 text-red-900';
      default: return 'bg-slate-50 border-slate-200 text-slate-900';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low': return <CheckCircle size={32} className="text-green-600" />;
      case 'medium': return <Info size={32} className="text-yellow-600" />;
      case 'urgent': return <ShieldAlert size={32} className="text-red-600" />;
      default: return <Info size={32} className="text-slate-600" />;
    }
  };

  const shareResult = () => {
    if (navigator.share) {
      navigator.share({
        title: 'HealthScan Analysis',
        text: `Analysis Result: ${data.risk_level?.toUpperCase()}. Findings: ${data.visual_findings_summary}`,
      }).catch(console.error);
    } else {
      alert("Sharing is not supported on this browser/device.");
    }
  };

  const handleFindCare = () => {
    if (!navigator.geolocation) {
      setMapSearch({ ...mapSearch, error: "Geolocation is not supported by your browser." });
      return;
    }

    setMapSearch({ isLoading: true, result: null, error: null });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const context = `${data.visual_findings_summary} ${data.symptom_summary}`;
          const result = await findNearbyPlaces(
            position.coords.latitude,
            position.coords.longitude,
            context,
            data.risk_level
          );
          setMapSearch({ isLoading: false, result, error: null });
        } catch (err: any) {
          setMapSearch({ 
            isLoading: false, 
            result: null, 
            error: "Failed to find nearby places. Please try again." 
          });
        }
      },
      (error) => {
        setMapSearch({ 
          isLoading: false, 
          result: null, 
          error: "Unable to retrieve your location. Please check permissions." 
        });
      }
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* View Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
        <button 
          className={`flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all duration-200 ${viewMode === 'simple' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setViewMode('simple')}
        >
          Simple View
        </button>
        <button 
          className={`flex-1 py-2 text-center rounded-lg text-sm font-semibold transition-all duration-200 ${viewMode === 'expert' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setViewMode('expert')}
        >
          Expert View
        </button>
      </div>

      {/* Header Card */}
      <div className={`p-6 rounded-2xl border shadow-sm ${getRiskStyles(data.risk_level)}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/60 backdrop-blur-sm rounded-full shadow-sm">
              {getRiskIcon(data.risk_level)}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-70">Assessed Risk Level</p>
              <h2 className="text-3xl font-extrabold capitalize tracking-tight">{data.risk_level || 'Unknown'}</h2>
              {data.risk_level === 'urgent' && (
                <div className="mt-2 inline-flex items-center px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full border border-red-200">
                  <AlertTriangle size={14} className="mr-1.5" /> Please seek medical attention
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={shareResult}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            title="Share Result"
          >
            <Share2 size={20} />
          </button>
        </div>
        <div className="mt-6 pt-4 border-t border-black/5">
           <p className="text-sm font-medium leading-relaxed opacity-90">
             <span className="font-bold opacity-100 uppercase text-xs mr-2 border border-current px-1.5 py-0.5 rounded">Reasoning</span>
             {data.risk_reasoning}
           </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Main Summary */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2 text-blue-600 mb-4">
            {viewMode === 'simple' ? <Brain size={20} /> : <Microscope size={20} />}
            <h3 className="font-bold text-lg">{viewMode === 'simple' ? 'Summary' : 'Detailed Findings'}</h3>
          </div>
          <div className="text-slate-700 prose prose-sm max-w-none prose-slate">
            <ReactMarkdown>
              {viewMode === 'simple' ? (data.user_friendly_summary || '') : (data.visual_findings_summary || '')}
            </ReactMarkdown>
          </div>
          
          {/* Visual Regions (Expert Mode) */}
          {viewMode === 'expert' && data.image_regions && data.image_regions.length > 0 && (
             <div className="mt-6 pt-4 border-t border-slate-100">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Identified Regions</p>
               <ul className="space-y-2">
                 {data.image_regions.map((region, idx) => (
                   <li key={idx} className="flex justify-between items-start text-sm">
                     <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded mr-2 whitespace-nowrap">{region.area}</span>
                     <span className="text-slate-500 text-right">{region.finding}</span>
                   </li>
                 ))}
               </ul>
             </div>
          )}
        </div>

        {/* Deep Reasoning (Expert Only) */}
        {viewMode === 'expert' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-2 text-purple-600 mb-4">
              <Brain size={20} />
              <h3 className="font-bold text-lg">Deep Reasoning</h3>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{data.deep_reasoning}</p>
          </div>
        )}

         {/* Urgent Signs */}
         {(data.urgent_signs_to_watch?.length > 0) && (
          <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm">
            <div className="flex items-center space-x-2 text-red-700 mb-4">
              <ShieldAlert size={20} />
              <h3 className="font-bold text-lg">Urgent Signs to Watch</h3>
            </div>
            <ul className="space-y-2">
              {(data.urgent_signs_to_watch || []).map((sign, idx) => (
                <li key={idx} className="flex items-start text-red-800 text-sm">
                  <span className="mr-2 mt-1 w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"></span>
                  {sign}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Possible Factors */}
        {data.possible_factors && data.possible_factors.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-2 text-slate-800 mb-4">
               <HelpCircle size={20} className="text-blue-500" />
               <h3 className="font-bold text-lg">Possible Factors</h3>
            </div>
            <ul className="space-y-3">
              {data.possible_factors.map((factor, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></div>
                  <span className="leading-relaxed">{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Lists */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-slate-800 mb-4">
            <Activity size={20} className="text-slate-600" />
            <h3 className="font-bold text-lg">Action Plan</h3>
          </div>
          
          <div className="space-y-6">
            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3">Recommended Actions</p>
              <ul className="space-y-2">
                {(data.do_list || []).map((item, idx) => (
                   <li key={idx} className="flex items-start gap-2.5">
                     <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                     <span className="text-sm text-slate-800 font-medium">{item}</span>
                   </li>
                ))}
                {(!data.do_list || data.do_list.length === 0) && (
                  <li className="text-sm text-slate-500 italic">No specific actions listed.</li>
                )}
              </ul>
            </div>

            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3">Avoid This</p>
              <ul className="space-y-2">
                {(data.avoid_list || []).map((item, idx) => (
                   <li key={idx} className="flex items-start gap-2.5">
                     <XIcon size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                     <span className="text-sm text-slate-800 font-medium">{item}</span>
                   </li>
                ))}
                {(!data.avoid_list || data.avoid_list.length === 0) && (
                  <li className="text-sm text-slate-500 italic">No specific avoidances listed.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Find Nearby Care Section */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
               <MapPin size={24} />
             </div>
             <div>
               <h3 className="font-bold text-lg text-indigo-900">Find Nearby Care</h3>
               <p className="text-sm text-indigo-700">Locate doctors or hospitals matched to your condition.</p>
             </div>
          </div>
          <button 
             onClick={handleFindCare}
             disabled={mapSearch.isLoading}
             className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-semibold shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {mapSearch.isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Navigation size={18} />
                Find Near Me
              </>
            )}
          </button>
        </div>

        {mapSearch.error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
            {mapSearch.error}
          </div>
        )}

        {/* Map View */}
        {mapSearch.result && (
          <div className="mt-4 bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm animate-fade-in flex flex-col md:flex-row h-[450px]">
             {/* Map Container */}
             <div ref={mapContainerRef} className="flex-1 h-full bg-slate-100 relative z-0" />
             
             {/* Side List (Desktop) / Bottom List (Mobile) */}
             <div className="w-full md:w-80 bg-white border-l border-slate-100 overflow-y-auto p-4 flex-shrink-0">
                <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-3">Found {mapSearch.result.places.length} Locations</h4>
                <div className="space-y-3">
                   {mapSearch.result.places.length === 0 && (
                     <p className="text-sm text-slate-500 italic">No specific coordinates found. Try searching broadly on Google Maps.</p>
                   )}
                   {mapSearch.result.places.map((place, idx) => (
                     <div key={idx} className="p-3 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors group cursor-pointer" onClick={() => {
                        if (mapInstanceRef.current && place.latitude && place.longitude) {
                          mapInstanceRef.current.flyTo([place.latitude, place.longitude], 16);
                        }
                     }}>
                       <h5 className="font-bold text-slate-800 text-sm mb-1">{place.name}</h5>
                       <div className="flex items-center text-xs text-yellow-600 mb-1">
                          <Star size={12} className="fill-current mr-1" />
                          <span>{place.rating || 'N/A'}</span>
                       </div>
                       <p className="text-xs text-slate-500 mb-2 line-clamp-2">{place.address}</p>
                       <p className="text-xs text-indigo-700 bg-indigo-50/50 p-1 rounded italic border border-indigo-100/50">
                         {place.reason}
                       </p>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Lifestyle Factors (Simple Mode) */}
      {viewMode === 'simple' && data.estimated_lifestyle_factors && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
            <Activity size={20} className="text-blue-500" /> Lifestyle Impact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <div className="w-10 h-10 mx-auto bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mb-3">
                <Heart size={20} />
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Stress</p>
              <p className="text-sm font-semibold text-slate-800">{data.estimated_lifestyle_factors?.stress || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <div className="w-10 h-10 mx-auto bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                <Moon size={20} />
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Sleep</p>
              <p className="text-sm font-semibold text-slate-800">{data.estimated_lifestyle_factors?.sleep_quality || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <div className="w-10 h-10 mx-auto bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-3">
                <Utensils size={20} />
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Diet</p>
              <p className="text-sm font-semibold text-slate-800">{data.estimated_lifestyle_factors?.diet_impact || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Report (Expert Mode or dedicated section) */}
      {data.doctor_report && (
      <div className="bg-white border border-slate-300 rounded-lg p-8 shadow-sm print:shadow-none print:border-none">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h3 className="font-serif font-bold text-2xl text-slate-900">{data.doctor_report.title || 'HealthScan Report'}</h3>
            <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">Auto-Generated Summary for Healthcare Providers</p>
          </div>
          <FileText size={32} className="text-slate-800" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Visual Observations</p>
            <p className="text-sm text-slate-800 leading-relaxed">{data.doctor_report.visual_description || 'No visual description available.'}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Symptom Notes</p>
            <p className="text-sm text-slate-800 leading-relaxed">{data.doctor_report.symptom_notes || 'No symptom notes available.'}</p>
          </div>
        </div>
        
        <div className="mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Risk Assessment</p>
          <div className="inline-block px-3 py-1 bg-slate-100 rounded text-sm font-bold text-slate-900 capitalize border border-slate-200">
            {data.doctor_report.risk_level || 'Pending'}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recommended Clinical Questions</p>
          <ul className="list-disc pl-5 space-y-1">
            {(data.doctor_report.suggested_questions || []).map((q, idx) => (
              <li key={idx} className="text-sm text-slate-700">{q}</li>
            ))}
             {(!data.doctor_report.suggested_questions || data.doctor_report.suggested_questions.length === 0) && (
              <li className="text-sm text-slate-500 italic">No specific questions generated.</li>
            )}
          </ul>
        </div>
      </div>
      )}

      {/* Follow-up Recommendation */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
         <p className="text-blue-800 font-medium text-sm flex items-center justify-center gap-2">
           <span>📅</span> Follow-up: {data.followup_recommendation || 'As needed'}
         </p>
      </div>

      {/* Disclaimer */}
      <div className="p-4 bg-slate-100 rounded-xl text-center text-xs text-slate-500 leading-relaxed flex items-center justify-center gap-2">
        <AlertTriangle size={14} className="flex-shrink-0" />
        {data.disclaimer}
      </div>
    </div>
  );
};