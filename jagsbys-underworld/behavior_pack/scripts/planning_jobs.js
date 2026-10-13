import {system} from '@minecraft/server';
// Fixed work and time budgets prevent generator jobs filling the entire script
// timeslice, especially while waiting for another tick or asynchronous loading.
export function runPlanningJob(job,{steps=24,milliseconds=2,onError=error=>console.warn(`[Underworld planning] ${error}`)}={}){
 let cancelled=false;
 function run(){
  if(cancelled)return;
  const start=Date.now();
  try{
   for(let i=0;i<steps;i++){
    const next=job.next();if(next.done)return;
    if(next.value?.waitTicks){system.runTimeout(run,next.value.waitTicks);return;}
    if(Date.now()-start>=milliseconds)break;
   }
   system.runTimeout(run,1);
  }catch(error){try{job.return?.();}finally{onError(error);}}
 }
 system.runTimeout(run,1);
 return ()=>{cancelled=true;job.return?.();};
}
