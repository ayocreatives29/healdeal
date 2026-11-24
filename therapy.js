'use strict';
/* Evidence-based psychotherapy tools, affect labeling, somatic body mapping,
   and public-domain scripture references for HealDeal.
   Contains NO personal user data; merges cleanly at runtime with the
   passcode-encrypted content bundle so the user's passcode is never altered. */

window.HEALDEAL_THERAPY = (() => {
  const VERSES = {
    'psalm-62-8': {
      ref: 'Psalm 62:8',
      text: 'Trust in him at all times, you people. Pour out your heart before him. God is a refuge for us.',
    },
    'psalm-56-8': {
      ref: 'Psalm 56:8',
      text: 'You count my wanderings. You put my tears into your container. Aren’t they in your book?',
    },
    'psalm-46-10': {
      ref: 'Psalm 46:10',
      text: 'Be still, and know that I am God.',
    },
    'psalm-139-23': {
      ref: 'Psalm 139:23–24',
      text: 'Search me, God, and know my heart. Try me, and know my thoughts. See if there is any wicked way in me, and lead me in the everlasting way.',
    },
    'psalm-42-11': {
      ref: 'Psalm 42:11',
      text: 'Why are you in despair, my soul? Why are you disturbed within me? Hope in God! For I shall still praise him, the saving help of my countenance, and my God.',
    },
    'isa-41-10': {
      ref: 'Isaiah 41:10',
      text: 'Don’t you be afraid, for I am with you. Don’t be dismayed, for I am your God. I will strengthen you. Yes, I will help you.',
    },
    'matt-11-28': {
      ref: 'Matthew 11:28',
      text: 'Come to me, all you who labor and are heavily burdened, and I will give you rest.',
    },
    '2cor-1-3': {
      ref: '2 Corinthians 1:3–4',
      text: 'Blessed be the God and Father of our Lord Jesus Christ, the Father of mercies and God of all comfort, who comforts us in all our affliction.',
    },
    'eph-4-32': {
      ref: 'Ephesians 4:32',
      text: 'And be kind to one another, tenderhearted, forgiving each other, just as God also in Christ forgave you.',
    },
    '1pet-5-7': {
      ref: '1 Peter 5:7',
      text: 'casting all your worries on him, because he cares for you.',
    },
  };

  /* Affect Labeling (Lieberman) + Emotion-Focused Therapy (Greenberg):
     Distinguishing protective surface feelings from deeper primary emotions. */
  const EMOTION_FAMILIES = [
    {
      id: 'grief',
      name: 'Hurt & Grief',
      short: 'Heavy, sad, lonely, or aching',
      tone: 'water',
      surface: ['Sad', 'Heavy', 'Disappointed', 'Empty', 'Drained', 'Tearful'],
      primary: ['Heartbroken', 'Lonely', 'Rejected', 'Abandoned', 'Longing', 'Mourning'],
      suggest: ['rain', 'lament', 'expressive-writing', 'ifs-parts'],
    },
    {
      id: 'anger',
      name: 'Anger & Friction',
      short: 'Frustrated, guarded, or resentful',
      tone: 'ember',
      surface: ['Angry', 'Frustrated', 'Irritated', 'Defensive', 'Resentful', 'Bitter'],
      primary: ['Betrayed', 'Unheard', 'Disrespected', 'Powerless', 'Hurt underneath', 'Wounded trust'],
      suggest: ['emotion-map', 'hurting', 'empty-chair', 'reach-forgive'],
    },
    {
      id: 'fear',
      name: 'Fear & Anxiety',
      short: 'Restless, worried, or overwhelmed',
      tone: 'lamp',
      surface: ['Anxious', 'Worried', 'Overwhelmed', 'On edge', 'Restless', 'Racing mind'],
      primary: ['Unsafe', 'Uncertain', 'Afraid of being hurt again', 'Afraid of being alone', 'Vulnerable', 'Helpless'],
      suggest: ['nervous-reset', 'window-tipp', 'act-defusion', 'ground'],
    },
    {
      id: 'shame',
      name: 'Shame & Regret',
      short: 'Self-critical, replaying, or heavy guilt',
      tone: 'ember',
      surface: ['Regretful', 'Self-critical', 'Embarrassed', 'Stuck replaying', 'Foolish', 'Guilty'],
      primary: ['Unworthy', 'Not enough', 'Exposed', 'Condemned', 'Wishing I could redo it', 'Disappointed in myself'],
      suggest: ['forgive-self', 'rain', 'thought-check', 'ifs-parts'],
    },
    {
      id: 'numb',
      name: 'Numb & Shut Down',
      short: 'Foggy, flat, or disconnected',
      tone: 'muted',
      surface: ['Numb', 'Foggy', 'Disconnected', 'Flat', 'Checked out', 'Exhausted'],
      primary: ['Carrying too much', 'Bracing for more pain', 'Guarded heart', 'Weary', 'Needing safety'],
      suggest: ['window-tipp', 'ground', 'nervous-reset', 'expressive-writing'],
    },
    {
      id: 'peace',
      name: 'Peace & Hope',
      short: 'Steady, grateful, or hopeful',
      tone: 'water',
      surface: ['Calm', 'Grateful', 'Relieved', 'Clear', 'Grounded', 'Tender'],
      primary: ['Hopeful', 'Held by God', 'Restored', 'Wiser', 'Open to the future', 'At peace'],
      suggest: ['act-defusion', 'lament', 'forgive-self'],
    },
  ];

  const BODY_ZONES = [
    { id: 'head', label: 'Head & Mind', cx: 100, cy: 34, r: 21 },
    { id: 'jaw', label: 'Jaw & Face', cx: 100, cy: 56, r: 12 },
    { id: 'throat', label: 'Throat', cx: 100, cy: 76, r: 11 },
    { id: 'shoulders', label: 'Shoulders', cx: 100, cy: 96, r: 22, twin: [[66, 98], [134, 98]] },
    { id: 'chest', label: 'Chest & Heart', cx: 100, cy: 126, r: 22 },
    { id: 'stomach', label: 'Stomach & Gut', cx: 100, cy: 170, r: 21 },
    { id: 'hands', label: 'Arms & Hands', cx: 100, cy: 186, r: 14, twin: [[46, 194], [154, 194]] },
    { id: 'legs', label: 'Legs & Feet', cx: 100, cy: 266, r: 16, twin: [[82, 266], [118, 266]] },
  ];

  const BODY_SENSATIONS = [
    'Tight', 'Heavy', 'Aching', 'Knotted', 'Hollow', 'Racing',
    'Lump in throat', 'Hot', 'Cold', 'Numb', 'Shaky', 'Restless', 'Warm & soft',
  ];

  const WINDOW_ZONES = [
    {
      id: 'hyper',
      title: 'Above the window · Flooded / Wired',
      tag: 'Fight or flight',
      tone: 'ember',
      signs: 'Racing thoughts, tight chest, anger, panic, urgency to text or fix things right now.',
      guidance: 'Your nervous system is on high alert. Slow down the body first with cold water, long exhales, or the Butterfly Hug before making any decisions.',
      links: ['nervous-reset', 'hurting'],
    },
    {
      id: 'optimal',
      title: 'Inside the window · Grounded / Present',
      tag: 'Safe enough to process',
      tone: 'water',
      signs: 'You may still feel sad or tender, yet you can breathe, reflect honestly, and stay present without being swept away.',
      guidance: 'This is the best state for deep emotional work — journaling, RAIN, forgiveness, or exploring lessons with wisdom.',
      links: ['rain', 'emotion-map'],
    },
    {
      id: 'hypo',
      title: 'Below the window · Numb / Shut down',
      tag: 'Freeze or collapse',
      tone: 'lamp',
      signs: 'Foggy, flat, exhausted, disconnected, wanting to withdraw or scroll away the pain.',
      guidance: 'Your nervous system hit the brakes to protect you. Use gentle sensory warmth, movement, and 5-4-3-2-1 grounding to come slowly back into your body.',
      links: ['ground', 'expressive-writing'],
    },
  ];

  const CATEGORIES = [
    { id: 'calm', name: 'Calm & stabilise', sub: 'When emotion is loud, urgent, or numb' },
    { id: 'express', name: 'Express & release', sub: 'Name what is inside and let it move through' },
    { id: 'reframe', name: 'Understand & unhook', sub: 'Step back from painful thoughts and inner conflict' },
    { id: 'forgive', name: 'Forgive & move forward', sub: 'Release the debt and choose your next step' },
  ];

  /* Clinical metadata for both encrypted built-in exercises and added psychotherapy tools. */
  const META = {
    'hurting': {
      cat: 'calm', badge: 'Breath · Pause', duration: '3–5 min',
      why: 'Slowing your breath calms the threat response before checking whether hurt is distorting how you read the situation.',
    },
    'nervous-reset': {
      cat: 'calm', badge: 'EMDR · Breath', duration: '3–5 min',
      why: 'Cyclic physiological sighing (Balban et al., Stanford 2023 RCT) rapidly lowers physiological arousal, while the EMDR Butterfly Hug uses alternating bilateral taps to soothe distress.',
    },
    'window-tipp': {
      cat: 'calm', badge: 'DBT · Polyvagal', duration: '3–5 min',
      why: 'Combining Dan Siegel’s Window of Tolerance with Marsha Linehan’s DBT TIPP skills resets body chemistry when talking alone cannot calm an overwhelm wave.',
    },
    'ground': {
      cat: 'calm', badge: 'Grounding', duration: '2–3 min',
      why: 'Sensory orientation (5-4-3-2-1) pulls attention out of rumination loops and signals present-moment physical safety to the brain.',
    },
    'reach-out': {
      cat: 'calm', badge: 'Urge surfing', duration: '10 min',
      why: 'Urge surfing (Alan Marlatt / DBT) uses a brief delay and safe expression so intense emotional impulses crest and pass without regret.',
    },
    'emotion-map': {
      cat: 'express', badge: 'EFT · Somatic', duration: '4–6 min',
      why: 'Affect labeling (Matthew Lieberman, UCLA fMRI) quiets amygdala alarm simply by naming emotions accurately, while EFT uncovers the softer primary feelings beneath anger or shutdown.',
    },
    'rain': {
      cat: 'express', badge: 'RAIN · Compassion', duration: '5–8 min',
      why: 'Tara Brach’s RAIN (Recognize, Allow, Investigate, Nurture) blends mindfulness and self-compassion to metabolize difficult emotions instead of fighting or suppressing them.',
    },
    'expressive-writing': {
      cat: 'express', badge: 'Pennebaker', duration: '5–15 min',
      why: 'James Pennebaker’s Expressive Writing protocol (100+ clinical studies) shows that continuous, uncensored emotional writing organizes painful memories and lowers autonomic stress.',
    },
    'empty-chair': {
      cat: 'express', badge: 'Gestalt', duration: '6–10 min',
      why: 'Fritz Perls’s Empty Chair technique helps complete “unfinished business” by expressing unspoken truths safely and finding internal closure.',
    },
    'letter': {
      cat: 'express', badge: 'Expressive', duration: '5–15 min',
      why: 'Writing an unsent letter allows full emotional honesty and narrative closure without reopening relational conflict.',
    },
    'lament': {
      cat: 'express', badge: 'Biblical Lament', duration: '5–8 min',
      why: 'Lament gives honest voice to grief before God rather than bypassing pain, moving naturally from complaint to petition and grounded trust.',
    },
    'thought-check': {
      cat: 'reframe', badge: 'CBT', duration: '5–8 min',
      why: 'Aaron Beck’s CBT Thought Record examines painful automatic thoughts against real evidence to reduce distress and black-and-white thinking.',
    },
    'act-defusion': {
      cat: 'reframe', badge: 'ACT · Values', duration: '5–8 min',
      why: 'Acceptance and Commitment Therapy (Steven Hayes / Russ Harris) weakens sticky thoughts through cognitive defusion and redirects energy toward your chosen values.',
    },
    'ifs-parts': {
      cat: 'reframe', badge: 'IFS Parts Work', duration: '6–10 min',
      why: 'Internal Family Systems (Richard Schwartz) helps you step back from critical or defensive inner parts and meet the hurting part underneath with compassion.',
    },
    'forgive-other': {
      cat: 'forgive', badge: 'Forgiveness', duration: '5–10 min',
      why: 'Naming specific hurts honestly and choosing to release the debt separates forgiveness from excusing harm or forgetting wisdom.',
    },
    'reach-forgive': {
      cat: 'forgive', badge: 'REACH · 30+ RCTs', duration: '8–12 min',
      why: 'Everett Worthington’s REACH forgiveness pathway is supported by over 30 randomized controlled trials for reducing bitterness, anxiety, and depression while cultivating peace.',
    },
    'forgive-self': {
      cat: 'forgive', badge: 'Self-Compassion', duration: '6–10 min',
      why: 'Separating healthy responsibility from self-punishment (Kristin Neff’s self-compassion research) breaks shame spirals and supports genuine growth.',
    },
  };

  const EXERCISES = [
    {
      id: 'emotion-map',
      title: 'Name what I feel',
      line: 'Uncover the feeling beneath the feeling, and locate it in your body',
      scaleLabel: 'Heaviness',
      steps: [
        {
          type: 'scale',
          key: 'before',
          title: 'How heavy does this feel right now?',
          hint: 'Take a slow breath and check in honestly. 0 is light, 10 is overwhelming.',
          lowLabel: 'Light',
          highLabel: 'Overwhelming',
        },
        {
          type: 'emotions',
          key: 'emotions',
          title: 'Put words to what is here',
          hint: 'Start with a family, tap what is on the surface, and look gently for any deeper primary feeling underneath.',
        },
        {
          type: 'bodymap',
          key: 'body',
          title: 'Where do you feel it in your body?',
          hint: 'Tap the areas holding tension or ache, then pick any words that match the sensation.',
        },
        {
          type: 'field',
          key: 'need',
          title: 'What is this feeling asking for?',
          hint: 'Every emotion carries a signal about a real human need.',
          chips: [
            'To be heard and understood',
            'Safety and honesty',
            'Rest and room to grieve',
            'Reassurance that I matter',
            'Clarity and wisdom',
            'Comfort from God',
          ],
          placeholder: 'Underneath this feeling, what I really need is…',
        },
        {
          type: 'field',
          key: 'truth',
          title: 'Give it one honest sentence',
          hint: 'Speak plainly from the deeper feeling — without judging yourself for having it.',
          placeholder: 'Right now, I feel… because…',
          verse: 'psalm-62-8',
        },
        {
          type: 'scale',
          key: 'after',
          title: 'How heavy does it feel now?',
          hint: 'Even a drop of 1 or 2 points means your nervous system is beginning to settle.',
          lowLabel: 'Light',
          highLabel: 'Overwhelming',
        },
      ],
    },
    {
      id: 'nervous-reset',
      title: 'Calm my nervous system',
      line: 'Cyclic physiological sigh & EMDR Butterfly Hug',
      scaleLabel: 'Body tension',
      steps: [
        {
          type: 'scale',
          key: 'before',
          title: 'How tense or activated is your body?',
          hint: 'Notice your chest, jaw, and breathing before we begin.',
          lowLabel: 'Calm',
          highLabel: 'Flooded',
        },
        {
          type: 'breathe',
          key: 'breath',
          defaultMode: 'sigh',
          title: 'Physiological sigh',
          body: [
            'Take one deep breath in through your nose, add a quick second top-off sip of air, then sigh out long and slow through your mouth.',
            'Do 4 to 6 rounds. You can switch breathing rhythms below any time.',
          ],
        },
        {
          type: 'bilateral',
          key: 'butterfly',
          title: 'The Butterfly Hug',
          body: [
            'Cross your arms over your chest so each hand rests gently on the opposite shoulder or upper arm.',
            'Follow the left–right glow with slow, light alternating taps. Let feelings pass through like weather while your hands anchor you.',
          ],
        },
        {
          type: 'field',
          key: 'shift',
          title: 'What shifted in your body?',
          hint: 'Optional. Notice even a small physical sign of settling.',
          chips: [
            'My shoulders dropped',
            'My breathing slowed down',
            'My chest feels slightly looser',
            'My thoughts feel less urgent',
            'Still tender, but steadier',
          ],
          placeholder: 'Right now my body feels…',
          optional: true,
        },
        {
          type: 'scale',
          key: 'after',
          title: 'How tense is your body now?',
          hint: 'Notice where you landed.',
          lowLabel: 'Calm',
          highLabel: 'Flooded',
          verse: 'psalm-46-10',
        },
      ],
    },
    {
      id: 'window-tipp',
      title: 'Window of Tolerance & TIPP',
      line: 'Read your nervous system and reset your body first',
      steps: [
        {
          type: 'window',
          key: 'zone',
          title: 'Where is your nervous system right now?',
          hint: 'Tap the zone that fits best. Being outside your window is a stress reflex, not a failure.',
        },
        {
          type: 'check',
          key: 'tipp',
          title: 'Reset your body (DBT TIPP)',
          body: [
            'When feelings are too intense or too numb, change body chemistry first. Tick any step you try right now:',
          ],
          items: [
            'Temperature: splash cold water on your face or hold a cool glass for 30 seconds to slow your heart rate.',
            'Intense brief movement: 60 seconds of brisk walking, wall push-ups, or shaking out your arms and legs.',
            'Paced breathing: breathe in for 4 and slowly out for 6–8 for five rounds.',
            'Paired muscle relaxation: tighten shoulders and fists for 5 seconds, then drop them completely on a slow exhale.',
          ],
          after: 'Good. A physical reset tells your brain that you are safe enough to slow down.',
        },
        {
          type: 'field',
          key: 'anchor',
          title: 'One steady truth for the next hour',
          hint: 'Optional. Keep it short and gentle.',
          chips: [
            'I do not have to solve everything tonight.',
            'This wave will rise, crest, and pass.',
            'I am safe in this room right now.',
            'God is holding me while I rest.',
          ],
          placeholder: 'For the next hour, I will remember…',
          short: true,
          optional: true,
          verse: 'isa-41-10',
        },
      ],
    },
    {
      id: 'rain',
      title: 'Sit with a heavy feeling (RAIN)',
      line: 'Recognize, Allow, Investigate with kindness, Nurture',
      scaleLabel: 'Emotional intensity',
      steps: [
        {
          type: 'read',
          title: 'Making room instead of fighting',
          body: [
            'Pushing a painful feeling down often makes it louder. RAIN is a gentle four-step practice from mindfulness and self-compassion research:',
            'Recognize what is here · Allow it to be · Investigate with warmth · Nurture what hurts.',
          ],
        },
        {
          type: 'scale',
          key: 'before',
          title: 'How intense is this feeling right now?',
          hint: '0 is calm, 10 is overwhelming.',
          lowLabel: 'Mild',
          highLabel: 'Intense',
        },
        {
          type: 'emotions',
          key: 'recognize',
          title: 'R — Recognize what is happening',
          hint: 'Whisper the name of what is present right now without arguing with it.',
        },
        {
          type: 'choose',
          key: 'allow',
          title: 'A — Allow it to be here',
          body: [
            'Allowing does not mean liking what happened. It simply means stopping the inner war for one minute.',
            '“This feeling is here right now. I can let it breathe without acting on it or running from it.”',
          ],
          button: 'I allow this wave to be here',
        },
        {
          type: 'bodymap',
          key: 'investigate',
          title: 'I — Investigate with kindness',
          hint: 'Where does this emotion sit in your body? Approach it with gentle curiosity rather than harsh judgement.',
        },
        {
          type: 'field',
          key: 'belief',
          title: 'I — What is this hurt believing?',
          hint: 'Optional. Notice any unspoken painful belief hiding inside the feeling.',
          chips: [
            'I am all alone',
            'I am not enough',
            'I cannot trust again',
            'I failed and ruined things',
            'This ache will never lift',
          ],
          placeholder: 'The painful belief underneath feels like…',
          optional: true,
        },
        {
          type: 'field',
          key: 'nurture',
          title: 'N — Nurture what hurts',
          hint: 'Rest a hand gently over your chest if you like. What compassionate words does this hurting place need from you, and from God?',
          chips: [
            'It makes sense that this hurts so much.',
            'You are not alone — God is near to the brokenhearted.',
            'You do not have to carry this perfectly.',
            'May I be gentle with myself today.',
            'His compassion does not fail.',
          ],
          placeholder: 'Words of kindness and comfort I need right now…',
          verse: '2cor-1-3',
        },
        {
          type: 'scale',
          key: 'after',
          title: 'How intense does the feeling feel now?',
          hint: 'Notice any softening, even if the feeling is still quietly present.',
          lowLabel: 'Mild',
          highLabel: 'Intense',
        },
      ],
    },
    {
      id: 'expressive-writing',
      title: '15-minute raw release',
      line: 'Continuous, uncensored expressive writing (Pennebaker)',
      steps: [
        {
          type: 'read',
          title: 'Write without editing',
          body: [
            'Research by psychologist James Pennebaker shows that writing continuously and honestly about deep emotional pain helps the brain organize what happened and eases physical stress.',
            'Pick a time limit, press Start, and keep writing without fixing spelling, grammar, or tone. Nobody else will ever see it.',
          ],
          verse: 'psalm-56-8',
        },
        {
          type: 'timedwrite',
          key: 'raw',
          title: 'Let it all out',
          hint: 'If you run out of words, repeat the last feeling or write “right now I notice…” until the next thought comes.',
          defaultMinutes: 10,
          options: [5, 10, 15],
          placeholder: 'Start anywhere. Write what hurts, what angers you, what you miss, what you fear…',
        },
        {
          type: 'field',
          key: 'insight',
          title: 'One breath back: what feels truest?',
          hint: 'Optional. After putting it all on the page, what single truth or theme stands out?',
          placeholder: 'What stands out most is…',
          optional: true,
        },
        {
          type: 'release',
          title: 'Keep or release it',
          body: [
            'You have moved this out of your head and body onto the page.',
            'Keep it privately in your journal, or symbolically release and dissolve it right now.',
          ],
          keepLabel: 'Keep in my journal',
          letgoLabel: 'Release & dissolve',
          letgoTitle: 'I released what I was carrying',
          letgoText: 'You wrote freely without censoring yourself and chose to release it into God’s hands.',
          letgoDone: 'Released. Take a slow breath.',
          verse: '1pet-5-7',
        },
      ],
    },
    {
      id: 'empty-chair',
      title: 'Say it to the empty chair',
      line: 'Speak unspoken truth safely and find closure (Gestalt)',
      steps: [
        {
          type: 'read',
          title: 'Unfinished conversations',
          body: [
            'Grief and anger stay stuck when words have nowhere to go. Imagine an empty chair across from you.',
            'Place a person, a past version of yourself, or a painful season in that chair. Say everything you need to say honestly, with no risk of making things worse.',
          ],
          verse: 'matt-11-28',
        },
        {
          type: 'field',
          key: 'name',
          title: 'Who or what is in the chair?',
          hint: 'Tap a suggestion or type a name.',
          chips: ['My past self', 'This painful season', 'The dream I had to grieve'],
          placeholder: 'Their name, or “my past self”',
          short: true,
        },
        {
          type: 'chair',
          key: 'dialogue',
          title: 'Speak to {name}',
          hint: 'Say what you never got to say directly. Then, if helpful, switch to the second tab to write the wiser perspective or closure you need.',
        },
        {
          type: 'release',
          title: 'Close the conversation',
          body: [
            'Take a deep breath and step back from the chair. Hand what remains unresolved over to God.',
          ],
          keepLabel: 'Keep in my journal',
          letgoLabel: 'Release & close',
          letgoTitle: 'I closed an unfinished conversation',
          letgoText: 'You spoke honestly to the empty chair and chose to leave the rest with God.',
          letgoDone: 'Closed and released.',
        },
      ],
    },
    {
      id: 'act-defusion',
      title: 'Unhook from a sticky thought',
      line: 'Create space from painful thoughts and steer by values (ACT)',
      scaleLabel: 'Grip of the thought',
      steps: [
        {
          type: 'read',
          title: 'Thoughts are stories, not orders',
          body: [
            'In Acceptance and Commitment Therapy (ACT), suffering intensifies when we get “hooked” by a painful thought and treat it as absolute reality.',
            'Instead of arguing with the mind, step back to notice the thought as passing words — then steer by what truly matters to you.',
          ],
          verse: 'psalm-42-11',
        },
        {
          type: 'field',
          key: 'thought',
          title: 'What sticky thought is hooking you?',
          chips: [
            'I will always hurt like this',
            'I ruined everything',
            'Nothing good will work out for me',
            'I cannot trust my judgement',
            'I am behind in life',
          ],
          placeholder: 'Write the short thought that keeps pulling at you',
          short: true,
        },
        {
          type: 'scale',
          key: 'before',
          title: 'How tightly is this thought hooking you?',
          hint: '0 means loosely passing by. 10 means completely pulling you around.',
          lowLabel: 'Loose',
          highLabel: 'Tightly hooked',
        },
        {
          type: 'defuse',
          key: 'defusion',
          sourceKey: 'thought',
          title: 'Create distance from the thought',
          hint: 'Tap each layer below and read it slowly out loud. Watch how adding distance weakens its grip.',
        },
        {
          type: 'values',
          key: 'values',
          title: 'Steer by your values instead',
          hint: 'Even while heavy feelings linger, who do you want to be today? Pick 1 to 3 values.',
          items: [
            'Faith & Trust', 'Integrity', 'Wisdom', 'Kindness', 'Courage',
            'Honesty', 'Peace', 'Self-respect', 'Family & Honour', 'Patience',
          ],
        },
        {
          type: 'field',
          key: 'step',
          title: 'One tiny values-aligned step today',
          hint: 'Choose one concrete, manageable action for today or this week. It will be added to your Steps forward.',
          placeholder: 'Today I will…',
          short: true,
          progress: true,
        },
        {
          type: 'scale',
          key: 'after',
          title: 'How tightly is that thought hooking you now?',
          hint: 'Notice how much breathing room opened up.',
          lowLabel: 'Loose',
          highLabel: 'Tightly hooked',
        },
      ],
    },
    {
      id: 'ifs-parts',
      title: 'Talk to the hurting part inside',
      line: 'Listen to your inner protector and care for the wound (IFS)',
      steps: [
        {
          type: 'read',
          title: 'A part of you, not all of you',
          body: [
            'When you feel pulled in two directions — angry yet grieving, guarding your heart yet longing for closeness — different “parts” inside are trying to protect you.',
            'You are larger than any anxious, critical, or hurting part. Let your calm, God-anchored Self sit beside it and listen.',
          ],
          verse: 'psalm-139-23',
        },
        {
          type: 'field',
          key: 'part',
          title: 'Which part feels loudest right now?',
          hint: 'Pick one or give it your own name.',
          chips: [
            'The Inner Critic',
            'The Angry Protector',
            'The Guarded Wall',
            'The Lonely Part',
            'The Anxious Fixer',
            'The Exhausted Part',
          ],
          placeholder: 'Name this part…',
          short: true,
        },
        {
          type: 'bodymap',
          key: 'where',
          title: 'Where do you notice this part?',
          hint: 'Locate it gently in or around your body, as if noticing a guest rather than becoming it.',
        },
        {
          type: 'field',
          key: 'protect',
          title: 'Ask it: what are you trying to protect me from?',
          hint: 'Even harsh or defensive parts usually took on their job to keep you from getting hurt again.',
          placeholder: 'It is trying to protect me from…',
        },
        {
          type: 'field',
          key: 'fear',
          title: 'What is it afraid would happen if it relaxed?',
          hint: 'Optional. Listen without arguing with it.',
          placeholder: 'It fears that if it stops working so hard…',
          optional: true,
        },
        {
          type: 'field',
          key: 'compassion',
          title: 'Speak to it from your calm, grounded Self',
          hint: 'Thank it for trying to look out for you, and share what is true today.',
          chips: [
            'Thank you for trying to keep me safe.',
            'I see how hard you have been working.',
            'You do not have to carry this alone anymore.',
            'I am here now, and God is watching over us.',
          ],
          placeholder: 'What I want this part to hear…',
        },
        {
          type: 'choose',
          key: 'unblend',
          title: 'Hold this part with compassion',
          body: [
            'I welcome this part with patience instead of shame. It is heard, and it does not have to take the wheel today.',
          ],
          button: 'I hold this part with compassion',
        },
      ],
    },
    {
      id: 'reach-forgive',
      title: 'REACH forgiveness path',
      line: 'Move from deciding to emotional peace (30+ clinical trials)',
      scaleLabel: 'Sting of the hurt',
      steps: [
        {
          type: 'read',
          title: 'The REACH pathway',
          body: [
            'Psychologist Everett Worthington’s REACH forgiveness model has been tested in over 30 randomized clinical trials to help replace bitterness with genuine emotional peace.',
            'R · Recall the hurt · E · Empathize without excusing · A · Altruistic gift · C · Commit · H · Hold on when memories return.',
          ],
          verse: 'eph-4-32',
        },
        {
          type: 'field',
          key: 'name',
          title: 'Who is this about?',
          placeholder: 'Their name',
          short: true,
        },
        {
          type: 'scale',
          key: 'before',
          title: 'How sharp is the sting or resentment right now?',
          hint: '0 is peaceful, 10 is burning sharp.',
          lowLabel: 'Peaceful',
          highLabel: 'Sharp sting',
        },
        {
          type: 'field',
          key: 'recall',
          title: 'R — Recall the hurt fairly',
          hint: 'Describe what happened clearly, without minimizing your pain and without demonizing {name}.',
          placeholder: 'What happened was…',
        },
        {
          type: 'field',
          key: 'empathize',
          title: 'E — Empathize (understand, not excuse)',
          hint: 'Understanding never justifies wrong. Gently ask: what fear, wound, pressure, or blind spot might {name} have been acting out of?',
          placeholder: 'Without excusing it, {name} may have been struggling with…',
          optional: true,
        },
        {
          type: 'field',
          key: 'altruistic',
          title: 'A — Altruistic gift of grace',
          hint: 'Remember a time God or someone else showed you undeserved mercy. Forgiveness is a free gift that sets your own heart free first.',
          placeholder: 'I remember receiving grace when…',
        },
        {
          type: 'choose',
          key: 'commit',
          title: 'C — Commit to forgiving {name}',
          body: [
            'I commit to forgiving {name} for this hurt. I release them to God’s justice and mercy while keeping the wisdom and boundaries I need.',
          ],
          button: 'I commit to forgiving {name}',
        },
        {
          type: 'field',
          key: 'hold',
          title: 'H — Hold on when the memory returns',
          hint: 'When the hurt resurfaces later, it means memory is working — not that forgiveness failed. Write a short anchor line for that moment.',
          chips: [
            'Remembering does not undo my forgiveness.',
            'I already placed this debt in God’s hands.',
            'I can keep my wisdom without keeping the bitterness.',
          ],
          placeholder: 'When this comes back to mind, I will tell myself…',
        },
        {
          type: 'scale',
          key: 'after',
          title: 'How sharp does the sting feel now?',
          hint: 'Emotional forgiveness often unfolds in layers. Notice any ease.',
          lowLabel: 'Peaceful',
          highLabel: 'Sharp sting',
        },
      ],
    },
  ];

  const BREATH_MODES = {
    sigh: {
      name: 'Cyclic Sigh',
      note: 'Double inhale through nose, long slow exhale (Stanford RCT)',
      phases: [
        ['Inhale deeply', 'mid', 2600],
        ['Top-off inhale', 'big', 1400],
        ['Long slow exhale', 'small', 6000],
      ],
    },
    box: {
      name: 'Box 4-4-4-4',
      note: 'Steady four-count square breath for focus and grounding',
      phases: [
        ['Breathe in', 'big', 4000],
        ['Hold softly', 'big', 4000],
        ['Breathe out', 'small', 4000],
        ['Rest empty', 'small', 4000],
      ],
    },
    calm478: {
      name: '4-7-8 Calm',
      note: 'Extended exhale breath to quiet racing thoughts or help sleep',
      phases: [
        ['Breathe in · 4', 'big', 4000],
        ['Hold · 7', 'big', 7000],
        ['Slow exhale · 8', 'small', 8000],
      ],
    },
  };

  return {
    VERSES,
    EMOTION_FAMILIES,
    BODY_ZONES,
    BODY_SENSATIONS,
    WINDOW_ZONES,
    CATEGORIES,
    META,
    EXERCISES,
    BREATH_MODES,
  };
})();
