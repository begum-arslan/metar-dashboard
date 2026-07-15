"use client";
import VisibilityPctTab from './tabs/VisibilityPctTab';
import VisibilityStationsPctTab from './tabs/VisibilityStationsPctTab';
import PhenomenaPctTab from './tabs/PhenomenaPctTab';
import CeilingPctTab from './tabs/CeilingPctTab';
import HeadTailWindPctTab from './tabs/HeadTailWindPctTab';
import VisHeadTailPctTab from './tabs/VisHeadTailPctTab';
import CloudTypePctTab from './tabs/CloudTypePctTab';
import TemperaturePctTab from './tabs/TemperaturePctTab';
import PressurePctTab from './tabs/PressurePctTab';

export default function PercentageView({ data, activeTab, reportInfo }) {
  return (
    <div>
      <div className="tab-content">
        {activeTab === 'visibility_pct' && (
          <VisibilityPctTab data={data} reportInfo={reportInfo} />
        )}

        {activeTab === 'visibility_stations_pct' && (
          <VisibilityStationsPctTab />
        )}

        {activeTab === 'phenomena_query_pct' && (
          <PhenomenaPctTab data={data} reportInfo={reportInfo} />
        )}

        {activeTab === 'ceiling_pct' && (
          <CeilingPctTab data={data} reportInfo={reportInfo} />
        )}

        {activeTab === 'head_tail_wind_pct' && (
          <HeadTailWindPctTab data={data} reportInfo={reportInfo} />
        )}

        {activeTab === 'vis_head_tail_wind_pct' && (
          <VisHeadTailPctTab data={data} reportInfo={reportInfo} />
        )}

        {activeTab === 'cloud_type_pct' && (
          <CloudTypePctTab data={data} reportInfo={reportInfo} />
        )}

        {activeTab === 'temperature_pct' && (
          <TemperaturePctTab data={data} reportInfo={reportInfo} />
        )}

        {activeTab === 'pressure_pct' && (
          <PressurePctTab data={data} reportInfo={reportInfo} />
        )}

        {/* Future percentage tabs will be added here */}
        {activeTab !== 'visibility_pct' && activeTab !== 'visibility_stations_pct' && activeTab !== 'phenomena_query_pct' && activeTab !== 'ceiling_pct' && activeTab !== 'head_tail_wind_pct' && activeTab !== 'vis_head_tail_wind_pct' && activeTab !== 'cloud_type_pct' && activeTab !== 'temperature_pct' && activeTab !== 'pressure_pct' && (
          <div className="glass-container" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>This tab will be available soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}

