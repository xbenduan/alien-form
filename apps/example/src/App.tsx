import React from "react";
import {
  Card,
  CardHeader,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@alien-form/ui";
import { ViewAlienForm } from "./component/view-alien-form";
import { EditAlienForm } from "./component/edit-alien-form";
import { CreateAlienForm } from "./component/create-alien-form";

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-muted/20 p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card>
          <CardHeader>企业级场景</CardHeader>
          <CardContent>
            <Tabs defaultValue="detail">
              <TabsList className="mb-4">
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="create">新增</TabsTrigger>
                <TabsTrigger value="detail">详情</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <EditAlienForm />
              </TabsContent>
              <TabsContent value="create">
                <CreateAlienForm />
              </TabsContent>
              <TabsContent value="detail">
                <ViewAlienForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
