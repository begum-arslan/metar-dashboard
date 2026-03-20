"use client";
import VisibilityTab from './tabs/VisibilityTab';
import PhenomenaTab from './tabs/PhenomenaTab';
import PrevailingWindTab from './tabs/PrevailingWindTab';
import CeilingTab from './tabs/CeilingTab';
import HeadTailWindTab from './tabs/HeadTailWindTab';
import VisHeadTailWindTab from './tabs/VisHeadTailWindTab';
import CloudTypeTab from './tabs/CloudTypeTab';
import TemperatureTab from './tabs/TemperatureTab';
import TempWithoutValueTab from './tabs/TempWithoutValueTab';
import PressureTab from './tabs/PressureTab';
import PressureWithoutValueTab from './tabs/PressureWithoutValueTab';

export default function ObservationsView({ data, activeTab }) {
  return (
    <div>
      <div className="tab-content">
        {activeTab === 'visibility' && (
          <VisibilityTab data={data} />
        )}
        
        {activeTab === 'phenomena' && (
          <PhenomenaTab data={data} />
        )}
        
        {activeTab === 'prevailing_wind' && (
           <PrevailingWindTab data={data} />
        )}
        
        {activeTab === 'ceiling' && (
           <CeilingTab data={data} />
        )}
        {activeTab === 'head_tail_wind' && (
           <HeadTailWindTab data={data} />
        )}
        {activeTab === 'vis_head_tail_wind' && (
           <VisHeadTailWindTab data={data} />
        )}
        {activeTab === 'cloud_type' && (
           <CloudTypeTab data={data} />
        )}
        {activeTab === 'temperature' && (
           <TemperatureTab data={data} />
        )}
        {activeTab === 'temp_without_value' && (
           <TempWithoutValueTab data={data} />
        )}
        {activeTab === 'pressure' && (
           <PressureTab data={data} />
        )}
        {activeTab === 'pressure_without_value' && (
           <PressureWithoutValueTab data={data} />
        )}
      </div>
    </div>
  );
}
