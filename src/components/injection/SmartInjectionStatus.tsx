import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, Target, TrendingUp, Calendar, Timer } from "lucide-react";
import type { Injection } from "@/hooks/useInjections";

interface SmartInjectionStatusProps {
  injection: Injection;
  remainingLeads: number;
  sentLeads?: number;
}

export function SmartInjectionStatus({ injection, remainingLeads, sentLeads = 0 }: SmartInjectionStatusProps) {
  // Force recalculation every 30 seconds to keep time-based stats fresh
  const [tick, setTick] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    if (!injection.working_start_time || !injection.working_end_time) {
      return null;
    }

    const now = new Date();
    
    // Parse working times (format: "HH:MM" or "HH:MM:SS")
    const endParts = injection.working_end_time.split(':').map(Number);
    const startParts = injection.working_start_time.split(':').map(Number);
    const endHour = endParts[0];
    const endMin = endParts[1] || 0;
    const startHour = startParts[0];
    const startMin = startParts[1] || 0;
    
    // Calculate end time for today in UTC
    const endTime = new Date(now);
    endTime.setUTCHours(endHour, endMin, 0, 0);
    
    // Calculate start time for today in UTC
    const startTime = new Date(now);
    startTime.setUTCHours(startHour, startMin, 0, 0);
    
    // Check if we're within working hours using Date comparison (more reliable)
    const isWithinHours = now >= startTime && now <= endTime;
    
    // Also check working day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[now.getUTCDay()];
    const isWorkingDay = !injection.working_days?.length || injection.working_days.includes(todayName);
    
    // Total window duration in minutes
    const totalWindowMinutes = ((endHour * 60 + endMin) - (startHour * 60 + startMin));
    
    // Time elapsed in window
    const elapsedMs = now.getTime() - startTime.getTime();
    const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
    
    if (!isWithinHours || !isWorkingDay) {
      // Calculate next working window start
      const nextStart = new Date(now);
      nextStart.setUTCHours(startHour, startMin, 0, 0);
      if (nextStart <= now) {
        nextStart.setDate(nextStart.getDate() + 1);
      }
      
      // Skip to next working day if needed
      if (injection.working_days?.length > 0) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        let attempts = 0;
        while (!injection.working_days.includes(dayNames[nextStart.getUTCDay()]) && attempts < 7) {
          nextStart.setDate(nextStart.getDate() + 1);
          attempts++;
        }
      }
      
      return {
        isWithinHours: false,
        nextWindowStart: nextStart,
        remainingMinutes: 0,
        elapsedMinutes: 0,
        totalWindowMinutes,
        leadsPerHour: 0,
        currentRate: 0,
        estimatedCompletion: null,
        willCompleteToday: false,
        workingHours: `${injection.working_start_time} - ${injection.working_end_time}`,
      };
    }
    
    // Calculate remaining time in current window
    const remainingMs = endTime.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));
    const remainingHours = remainingMinutes / 60;
    
    // Calculate required leads per hour rate to finish on time
    const leadsPerHour = remainingHours > 0 && remainingLeads > 0
      ? Math.round(remainingLeads / remainingHours)
      : 0;
    
    // Calculate current rate based on elapsed time and sent leads
    const elapsedHours = elapsedMinutes / 60;
    const currentRate = elapsedHours > 0 && sentLeads > 0
      ? Math.round(sentLeads / elapsedHours)
      : 0;
    
    // Calculate estimated completion time
    let estimatedCompletion: Date | null = null;
    let willCompleteToday = false;
    
    if (remainingLeads > 0 && remainingHours > 0) {
      const avgDelaySeconds = (remainingMinutes * 60) / remainingLeads;
      const totalTimeNeeded = remainingLeads * avgDelaySeconds * 1000;
      estimatedCompletion = new Date(now.getTime() + totalTimeNeeded);
      willCompleteToday = estimatedCompletion <= endTime;
    } else if (remainingLeads === 0) {
      willCompleteToday = true;
    }
    
    return {
      isWithinHours: true,
      nextWindowStart: null,
      remainingMinutes,
      elapsedMinutes,
      totalWindowMinutes,
      leadsPerHour,
      currentRate,
      estimatedCompletion,
      willCompleteToday,
      workingHours: `${injection.working_start_time} - ${injection.working_end_time}`,
    };
  }, [injection.working_start_time, injection.working_end_time, injection.working_days, remainingLeads, sentLeads, tick]);

  if (!stats) return null;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'UTC'
    }) + ' UTC';
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <>
      {/* Smart Mode Badge */}
      {injection.smart_mode && (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          <Zap className="h-3 w-3 mr-1" />
          Smart Mode
        </Badge>
      )}
      
      {/* Working Hours Badge - Always show */}
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        <Calendar className="h-3 w-3 mr-1" />
        {stats.workingHours}
      </Badge>
      
      {stats.isWithinHours ? (
        <>
          {/* Time Left Badge */}
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <Clock className="h-3 w-3 mr-1" />
            {formatDuration(stats.remainingMinutes)} left
          </Badge>
          
          {/* Time Elapsed Badge */}
          {stats.elapsedMinutes > 0 && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
              <Timer className="h-3 w-3 mr-1" />
              {formatDuration(stats.elapsedMinutes)} elapsed
            </Badge>
          )}
          
          {/* Required Rate Badge - Always show when there are remaining leads */}
          {remainingLeads > 0 && (
            <Badge 
              variant="outline" 
              title={`${remainingLeads} leads ÷ ${(stats.remainingMinutes / 60).toFixed(1)}h = ~${stats.leadsPerHour}/hour required`}
              className="bg-orange-500/10 text-orange-600 border-orange-500/30"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              ~{stats.leadsPerHour} leads/hour needed
            </Badge>
          )}
          
          {/* Current Rate Badge - Show if we've sent leads */}
          {stats.currentRate > 0 && sentLeads > 0 && (
            <Badge 
              variant="outline"
              title={`${sentLeads} leads sent in ${(stats.elapsedMinutes / 60).toFixed(1)}h`}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              {stats.currentRate} leads/hour actual
            </Badge>
          )}
          
          {/* Estimated Completion Badge */}
          {stats.estimatedCompletion && remainingLeads > 0 && (
            <Badge 
              variant="outline" 
              className={stats.willCompleteToday 
                ? 'bg-green-500/10 text-green-600 border-green-500/30' 
                : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
              }
            >
              <Target className="h-3 w-3 mr-1" />
              {stats.willCompleteToday 
                ? `Complete by ${formatTime(stats.estimatedCompletion)}`
                : 'Extends to next window'
              }
            </Badge>
          )}
          
          {/* Completed Badge */}
          {remainingLeads === 0 && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <Target className="h-3 w-3 mr-1" />
              All leads sent!
            </Badge>
          )}
        </>
      ) : (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
          <Clock className="h-3 w-3 mr-1" />
          Next window: {stats.nextWindowStart ? formatTime(stats.nextWindowStart) : 'Tomorrow'}
        </Badge>
      )}
    </>
  );
}
