use axum::{
    Router, response::Html, routing::get,
};

#[tokio::main]
async fn main() {
    // build our application with a single route
    let app = Router::new()
        .route("/", get(index_page));

    // run our app with hyper, listening globally on port 3000
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
    .await
    .unwrap();
    
    axum::serve(listener, app).await.unwrap();
}

async fn index_page() -> Html<&'static str> {
    Html(include_str!("../../frontend/html/index.html"))
}

