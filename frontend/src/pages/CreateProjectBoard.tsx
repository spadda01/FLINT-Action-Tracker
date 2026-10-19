import { useEffect, useState } from "react";
import { getProjects } from "../services/projectService";

type Project = {
  id: number;
  name: string;
  egnyteFolder: string;
  team: string[];
};

function CreateProjectBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [boardName, setBoardName] = useState("");
  const [egnyteFolder, setEgnyteFolder] = useState("");
  const [team, setTeam] = useState<string[]>([]);
  const [projectLoadFailed, setProjectLoadFailed] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await getProjects();
        setProjects(data);
      } catch {
        setProjectLoadFailed(true);
      }
    };

    loadProjects();
  }, []);

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);

    const project = projects.find(
      (project) => project.id === Number(projectId)
    );

    if (project) {
      setBoardName(project.name);
      setEgnyteFolder(project.egnyteFolder);
      setTeam(project.team);
    }
  };

  const handleCreateBoard = () => {
    if (!boardName.trim()) {
      alert("Please enter a board name.");
      return;
    }

    alert(`Board "${boardName}" created!`);
  };

  const handleToggleFailure = () => {
    const nextFailureState = !projectLoadFailed;

    setProjectLoadFailed(nextFailureState);

    if (nextFailureState) {
      setSelectedProject("");
      setTeam([]);
    }
  };

  return (
    <div>
      <h1>Create Project Board</h1>

      <button onClick={handleToggleFailure}>
        Toggle Project Load Failure
      </button>

      <br />
      <br />

      {projectLoadFailed ? (
        <div>
          <p>Project list could not be loaded.</p>
          <p>
            You can still create a board manually and link the project later.
          </p>
        </div>
      ) : (
        <>
          <label>FLINT Project</label>
          <br />

          <select
            value={selectedProject}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            <option value="">Select a project</option>

            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </>
      )}

      <br />
      <br />

      <label>Board Name</label>
      <br />
      <input
        value={boardName}
        onChange={(e) => setBoardName(e.target.value)}
        placeholder="Enter board name"
      />

      <br />
      <br />

      <label>Egnyte Folder</label>
      <br />
      <input
        value={egnyteFolder}
        onChange={(e) => setEgnyteFolder(e.target.value)}
        placeholder="Enter Egnyte folder link"
      />

      <br />
      <br />

      <h3>Project Team / Owner Suggestions</h3>

      {team.length > 0 ? (
        <ul>
          {team.map((member) => (
            <li key={member}>{member}</li>
          ))}
        </ul>
      ) : projectLoadFailed ? (
        <p>Project team information is unavailable.</p>
      ) : (
        <p>Select a project to see team members.</p>
      )}

      <button onClick={handleCreateBoard}>Create Board</button>
    </div>
  );
}

export default CreateProjectBoard;