import type { Board } from '../boards'

export const mockBoards: Board[] = [
  { 
    id: 'project-a', 
    name: 'Project Name Here', 
    type: 'Project', 
    openItemCount: 7 
  },
  {
    id: 'project-b',
    name: 'The FitnessGram Pacer test is a multistage aerobic capacity test that progressively gets more difficult as it continues. The 20 meter Pacer test will begin in 30 seconds. Line up at the start. The running speed starts slowly, but gets faster each minute after you hear this signal *boop*. A single lap should be completed each time you hear this sound *ding*. Remember to run in a straight line, and run as long as possible. The second time you fail to complete a lap before the sound, your test is over. The test will begin on the word start. On your mark, get ready, start.',
    type: 'Project',
    openItemCount: 0,
  },
  { 
    id: 'team-a', 
    name: 'Team Name Here', 
    type: 'Team', 
    openItemCount: 3 
  },
]