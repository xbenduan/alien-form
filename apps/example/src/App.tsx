import React, { useState } from "react";
import { ProductList } from "./component/product-list";
import { CreateAlienForm } from "./component/create-alien-form";
import { EditAlienForm } from "./component/edit-alien-form";
import { ViewAlienForm } from "./component/view-alien-form";

type Route =
  | { page: "list" }
  | { page: "create" }
  | { page: "edit"; id: string }
  | { page: "detail"; id: string };

export const App: React.FC = () => {
  const [route, setRoute] = useState<Route>({ page: "list" });

  const goList = () => setRoute({ page: "list" });
  const goCreate = () => setRoute({ page: "create" });
  const goEdit = (id: string) => setRoute({ page: "edit", id });
  const goDetail = (id: string) => setRoute({ page: "detail", id });

  return (
    <div className="min-h-screen bg-muted/20 p-6">
      <div className="mx-auto max-w-5xl">
        {route.page === "list" && (
          <ProductList
            onAdd={goCreate}
            onEdit={goEdit}
            onDetail={goDetail}
          />
        )}
        {route.page === "create" && (
          <CreateAlienForm onBack={goList} />
        )}
        {route.page === "edit" && (
          <EditAlienForm id={route.id} onBack={goList} />
        )}
        {route.page === "detail" && (
          <ViewAlienForm id={route.id} onBack={goList} />
        )}
      </div>
    </div>
  );
};
