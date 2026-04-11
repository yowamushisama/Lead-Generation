import { Injectable } from '@nestjs/common';

export type ObjectionType = 'price' | 'timing' | 'trust' | 'competitor' | 'no-need' | 'unknown';

export interface ObjectionResponse {
  type: ObjectionType;
  detected: boolean;
  suggestedApproach: string;
  exampleReply: string;
}

const PRICE_SIGNALS = [
  /too expensive/i,
  /can't afford/i,
  /out of (our )?budget/i,
  /cost too much/i,
  /cheaper option/i,
];
const TIMING_SIGNALS = [
  /not right now/i,
  /bad timing/i,
  /next quarter/i,
  /too busy/i,
  /maybe later/i,
];
const TRUST_SIGNALS = [/how do I know/i, /prove it/i, /not sure/i, /no guarantee/i, /what if/i];
const COMPETITOR_SIGNALS = [
  /already (have|working with|using)/i,
  /our current (provider|vendor|agency)/i,
];
const NO_NEED_SIGNALS = [/don't need/i, /not looking/i, /handle it in-house/i, /have someone/i];

@Injectable()
export class ObjectionHandlerService {
  detect(message: string): ObjectionResponse {
    if (PRICE_SIGNALS.some((r) => r.test(message))) {
      return {
        type: 'price',
        detected: true,
        suggestedApproach:
          'Anchor to cost of not solving the problem. Offer a smaller entry point.',
        exampleReply:
          "Totally fair — budget is always a consideration. Can I ask what you're currently spending on [problem area]? Sometimes the comparison changes things.",
      };
    }

    if (TIMING_SIGNALS.some((r) => r.test(message))) {
      return {
        type: 'timing',
        detected: true,
        suggestedApproach: 'Ask what would need to be true. Offer to reconnect at the right time.',
        exampleReply:
          "No rush at all. What would need to change for the timing to make sense? Happy to follow up in [X] weeks if that's more realistic.",
      };
    }

    if (TRUST_SIGNALS.some((r) => r.test(message))) {
      return {
        type: 'trust',
        detected: true,
        suggestedApproach: 'Offer concrete proof — case study, reference call, small pilot.',
        exampleReply:
          "That's a fair concern. Would it help to speak with one of our current clients? Or we could do a small scoped project first so you can judge the quality directly.",
      };
    }

    if (COMPETITOR_SIGNALS.some((r) => r.test(message))) {
      return {
        type: 'competitor',
        detected: true,
        suggestedApproach: "Ask how it's going. Position as specialist/backup.",
        exampleReply:
          "Good to know! How's it going with them? We often work as a specialist alongside existing teams — worth a quick chat to see if there's a gap we could fill?",
      };
    }

    if (NO_NEED_SIGNALS.some((r) => r.test(message))) {
      return {
        type: 'no-need',
        detected: true,
        suggestedApproach: 'Acknowledge and close loop gracefully. Leave the door open.',
        exampleReply:
          "Completely understood — sounds like you've got it handled. I'll leave you to it, but happy to chat if anything changes down the road.",
      };
    }

    return {
      type: 'unknown',
      detected: false,
      suggestedApproach: 'Continue conversation naturally.',
      exampleReply: '',
    };
  }
}
