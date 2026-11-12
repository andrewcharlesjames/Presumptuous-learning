/** Link to the Learn page for one skill. */
export const learnHref = (subject: string, grade: number, skill: string) =>
  `/student/learn?subject=${encodeURIComponent(subject)}&grade=${grade}&skill=${encodeURIComponent(skill)}`;
