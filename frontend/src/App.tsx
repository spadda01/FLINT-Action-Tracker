import './App.css'

function App() {
  return (
    <main>
      <header>
        <h1>FLINT Action Tracker</h1>
        <p>Find and open your project and team boards.</p>
      </header>

      <section aria-labelledby="project-heading">
        <h2 id="project-heading">Project Boards</h2>
        <p>Your project boards will appear here.</p>
      </section>

      <section aria-labelledby="team-heading">
        <h2 id="team-heading">Team Boards</h2>
        <p>Your team boards will appear here.</p>
      </section>
    </main>
  )
}

export default App