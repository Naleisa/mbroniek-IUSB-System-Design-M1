export default {
  name: 'landing-page-component',
  template: /* html */ `
    <div class="container py-4">
      <h1 class="mb-3">Welcome!</h1>
      <p class="lead">This is a web app template in need of customization and improved interaction design.</p>
      <router-link to="/items" class="btn btn-primary mb-4"><i class="bi bi-list-check me-1"></i>View the Example Collection</router-link>

      <h2 class="h4 mt-3">Template App Description</h2>
      <p>
        This is a simple Vue.js starter template that demonstrates how to build a small web app with a landing page, a collection page, and an item detail page. It uses Vue's Composition API for state management and Vue Router for navigation. The app loads a dataset from a CSV file and allows users to bookmark items for easy access later.
      </p>
      <p>
        Your goal is to customize the app by adapting it to a different dataset, improving the user interface and interaction design, and adding new features that enhance the user experience. You can use any public dataset that interests you, such as movies, books, recipes, or anything else you find compelling. The app is intentionally simple to give you a lot of freedom in how you choose to enhance it.
      </p>
    </div>
  `,
};
