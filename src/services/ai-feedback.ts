import { DriveSession } from './storage-service';

export const AIFeedbackService = {
  /**
   * Generates a descriptive coaching feedback string based on drive statistics.
   */
  generateFeedback(session: Pick<DriveSession, 'score' | 'eventBreakdown' | 'totalEvents'>): string {
    const { score, eventBreakdown, totalEvents } = session;

    if (score === 100) {
      return "Outstanding drive! You displayed perfect driving behaviors, with no harsh sensor events detected. Keep up this exemplary standard of road safety!";
    }

    const feedbacks: string[] = [];

    // Analyze specific errors
    if (eventBreakdown.phone_handling > 0) {
      feedbacks.push(
        `We detected phone manipulation ${eventBreakdown.phone_handling} time${
          eventBreakdown.phone_handling > 1 ? 's' : ''
        }. Phone usage is one of the leading causes of accidents. Keep your phone secured in a mount and ignore notifications while moving.`
      );
    }

    if (eventBreakdown.harsh_brake > 0) {
      feedbacks.push(
        `Harsh braking occurred ${eventBreakdown.harsh_brake} time${
          eventBreakdown.harsh_brake > 1 ? 's' : ''
        }. This typically happens due to tailgating or distractions. Try scanning the road 10-15 seconds ahead to anticipate traffic slowdowns.`
      );
    }

    if (eventBreakdown.harsh_accel > 0) {
      feedbacks.push(
        `We flagged harsh acceleration ${eventBreakdown.harsh_accel} time${
          eventBreakdown.harsh_accel > 1 ? 's' : ''
        }. Smooth throttle applications improve passenger comfort, increase fuel economy by up to 20%, and reduce wear on tires.`
      );
    }

    if (eventBreakdown.sharp_turn > 0) {
      feedbacks.push(
        `Sharp turns were recorded ${eventBreakdown.sharp_turn} time${
          eventBreakdown.sharp_turn > 1 ? 's' : ''
        }. Make sure to decelerate completely *before* entering intersections or curves rather than braking mid-turn.`
      );
    }

    if (eventBreakdown.aggressive_steer > 0) {
      feedbacks.push(
        `Aggressive steering or swerving was triggered ${eventBreakdown.aggressive_steer} time${
          eventBreakdown.aggressive_steer > 1 ? 's' : ''
        }. Sudden lateral movements can cause traction loss, especially on wet or icy roads. Drive with smooth, steady inputs.`
      );
    }

    if (eventBreakdown.excessive_movement > 0) {
      feedbacks.push(
        `Excessive device movement was registered. This indicates your phone is loose, sliding, or vibrating in the vehicle. Please use a stable dashboard mount to ensure accurate sensor readings and avoid distraction.`
      );
    }

    // High level summary sentence
    let prefix = '';
    if (score >= 90) {
      prefix = "Great job! Overall, your driving was safe and controlled. Here are minor tips to reach a perfect score:";
    } else if (score >= 75) {
      prefix = "Good effort, but several aggressive maneuvers were registered. Consider adjusting your habits to stay safe:";
    } else {
      prefix = "Caution: Your driving score is below average, indicating elevated risk. We strongly recommend working on these areas:";
    }

    return `${prefix}\n\n${feedbacks.map((f, i) => `${i + 1}. ${f}`).join('\n\n')}`;
  },
};
