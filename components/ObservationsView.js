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

export default function ObservationsView({ data, activeTab, reportInfo }) {
  return (
    <div>
      <div className="tab-content">
        {activeTab === 'visibility' && (
          <VisibilityTab data={data} reportInfo={reportInfo} />
        )}
        
        {activeTab === 'phenomena' && (
          <PhenomenaTab data={data} reportInfo={reportInfo} />
        )}
        
        {activeTab === 'prevailing_wind' && (
           <PrevailingWindTab data={data} reportInfo={reportInfo} />
        )}
        
        {activeTab === 'ceiling' && (
           <CeilingTab data={data} reportInfo={reportInfo} />
        )}
        {activeTab === 'head_tail_wind' && (
           <HeadTailWindTab data={data} reportInfo={reportInfo} />
        )}
        {activeTab === 'vis_head_tail_wind' && (
           <VisHeadTailWindTab data={data} reportInfo={reportInfo} />
        )}
        {activeTab === 'cloud_type' && (
           <CloudTypeTab data={data} reportInfo={reportInfo} />
        )}
        {activeTab === 'temperature' && (
           <TemperatureTab data={data} reportInfo={reportInfo} />
        )}
        {activeTab === 'temp_without_value' && (
           <TempWithoutValueTab data={data} reportInfo={reportInfo} />
        )}
        {activeTab === 'pressure' && (
           <PressureTab data={data} reportInfo={reportInfo} />
        )}
        {activeTab === 'pressure_without_value' && (
           <PressureWithoutValueTab data={data} reportInfo={reportInfo} />
        )}
      </div>
    </div>
  );
}

