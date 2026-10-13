import {runPlanningJob} from './planning_jobs.js';
const queue=[];let active=false;
export function generationBusy(){return active||queue.length>0;}
export function runGenerationJob(job){
 const entry={job,cancelled:false};queue.push(entry);pump();
 return ()=>{entry.cancelled=true;entry.cancel?.();entry.finish?.();};
}
function pump(){
 if(active)return;
 let entry;do{entry=queue.shift();}while(entry?.cancelled);
 if(!entry)return;
 active=true;
 let finished=false;
 entry.finish=()=>{if(finished)return;finished=true;active=false;pump();};
 function* wrapped(){try{yield* entry.job;}finally{entry.finish();}}
 entry.cancel=runPlanningJob(wrapped());
}
